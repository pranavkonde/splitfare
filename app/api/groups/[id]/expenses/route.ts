import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';
import { CreateExpenseApiSchema, ExpenseFilterSchema } from '@/lib/validations/expense';
import { ForbiddenError, AppError } from '@/lib/errors';
import { notificationService } from '@/services/notification';
import { calculateEqualSplit, calculatePercentageSplit, calculateSharesSplit, validateExactSplit } from '@/lib/splits';


const listExpenses = async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const groupId = params.id;
    const userId = toDbUserId(req.user.id);
    const { searchParams } = new URL(req.url);

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      throw new ForbiddenError('Access denied');
    }

    const filterParams = {
      category: searchParams.get('category') || undefined,
      paidBy: searchParams.get('paidBy') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      sortBy: searchParams.get('sortBy') || 'date',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      limit: parseInt(searchParams.get('limit') || '20'),
      cursor: searchParams.get('cursor') || undefined,
    };

    const validatedFilters = ExpenseFilterSchema.parse(filterParams);

    const baseSelect = `
      *,
      paidBy:users!expenses_created_by_fkey(id, name, avatar_url),
      splits:expense_splits(id, user_id, amount_owed, percentage_owed, shares)
    `;
    const buildQuery = (withSoftDeleteFilter: boolean) => {
      let q = supabaseAdmin
        .from('expenses')
        .select(baseSelect)
        .eq('group_id', groupId);
      if (withSoftDeleteFilter) {
        q = q.is('deleted_at', null);
      }
      return q;
    };

    let query = buildQuery(true);

    if (validatedFilters.category) {
      query = query.eq('category', validatedFilters.category);
    }
    if (validatedFilters.paidBy) {
      query = query.eq('created_by', validatedFilters.paidBy);
    }
    if (validatedFilters.startDate) {
      query = query.gte('created_at', validatedFilters.startDate);
    }
    if (validatedFilters.endDate) {
      query = query.lte('created_at', validatedFilters.endDate);
    }

    if (validatedFilters.cursor) {
      if (validatedFilters.sortOrder === 'desc') {
        query = query.lt('created_at', validatedFilters.cursor);
      } else {
        query = query.gt('created_at', validatedFilters.cursor);
      }
    }

    query = query
      .order(validatedFilters.sortBy === 'date' ? 'created_at' : 'total_amount', {
        ascending: validatedFilters.sortOrder === 'asc',
      })
      .limit(validatedFilters.limit + 1); 

    let { data: expenses, error: fetchError } = await query;

    if (fetchError && (fetchError as any).code === '42703') {
      query = buildQuery(false);

      if (validatedFilters.category) {
        query = query.eq('category', validatedFilters.category);
      }
      if (validatedFilters.paidBy) {
        query = query.eq('created_by', validatedFilters.paidBy);
      }
      if (validatedFilters.startDate) {
        query = query.gte('created_at', validatedFilters.startDate);
      }
      if (validatedFilters.endDate) {
        query = query.lte('created_at', validatedFilters.endDate);
      }
      if (validatedFilters.cursor) {
        if (validatedFilters.sortOrder === 'desc') {
          query = query.lt('created_at', validatedFilters.cursor);
        } else {
          query = query.gt('created_at', validatedFilters.cursor);
        }
      }
      query = query
        .order(validatedFilters.sortBy === 'date' ? 'created_at' : 'total_amount', {
          ascending: validatedFilters.sortOrder === 'asc',
        })
        .limit(validatedFilters.limit + 1);

      const fallback = await query;
      expenses = fallback.data;
      fetchError = fallback.error;
    }

    if (fetchError) {
      console.error('Error fetching expenses:', fetchError);
      throw new AppError('Failed to fetch expenses', 400);
    }

    const safeExpenses = expenses || [];
    const hasNextPage = safeExpenses.length > validatedFilters.limit;
    const paginatedExpenses = hasNextPage ? safeExpenses.slice(0, -1) : safeExpenses;
    const nextCursor = hasNextPage && paginatedExpenses.length > 0 ? paginatedExpenses[paginatedExpenses.length - 1].created_at : null;

    return createResponse({
      items: paginatedExpenses,
      nextCursor,
      hasNextPage,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
};

const createExpense = async (req: AuthenticatedRequest & { validatedBody: any }, { params }: { params: { id: string } }) => {
  try {
    const groupId = params.id;
    const userId = toDbUserId(req.user.id);
    const body = req.validatedBody;

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return createErrorResponse(new ForbiddenError('Access denied'));
    }

    // Normalize IDs: clients may send either users.id or group_members.id.
    // Convert everything to canonical users.id before writing expense/split rows.
    const rawIds = [body.paidById, ...body.splits.map((s: any) => s.userId)];
    const uniqueIds = Array.from(new Set(rawIds.filter(Boolean)));

    const { data: memberMappings, error: memberMappingsError } = await supabaseAdmin
      .from('group_members')
      .select('id, user_id')
      .eq('group_id', groupId)
      .or(`id.in.(${uniqueIds.join(',')}),user_id.in.(${uniqueIds.join(',')})`);

    if (memberMappingsError) {
      console.error('Error resolving member mappings:', memberMappingsError);
      return createErrorResponse(new AppError('Failed to validate expense members', 400));
    }

    const idToUserId = new Map<string, string>();
    for (const row of memberMappings || []) {
      idToUserId.set(row.id, row.user_id);
      idToUserId.set(row.user_id, row.user_id);
    }

    const normalizedPaidById = idToUserId.get(body.paidById);
    const normalizedSplits = body.splits.map((split: any) => ({
      ...split,
      userId: idToUserId.get(split.userId),
    }));

    if (!normalizedPaidById || normalizedSplits.some((s: any) => !s.userId)) {
      return createErrorResponse(
        new AppError('One or more selected members are invalid for this group', 400)
      );
    }

    const { data: expense, error: expenseError } = await supabaseAdmin
      .from('expenses')
      .insert({
        group_id: groupId,
        created_by: normalizedPaidById,
        description: body.description,
        total_amount: body.amount,
        category: body.category,
        split_type: body.splitType.toLowerCase(),
        created_at: body.date,
      })
      .select()
      .single();

    if (expenseError) {
      console.error('Error creating expense:', expenseError);
      return createErrorResponse(new AppError('Failed to create expense', 400));
    }

    let computedAmountByUserId = new Map<string, number>();
    try {
      if (body.splitType === 'EQUAL') {
        const computed = calculateEqualSplit(body.amount, normalizedSplits.map((s: any) => s.userId));
        computedAmountByUserId = new Map(computed.map((s) => [s.userId, s.amount]));
      } else if (body.splitType === 'EXACT') {
        const exactSplits: Array<{ userId: string; amount: number }> = normalizedSplits.map((s: any) => ({
          userId: s.userId,
          amount: Number(s.amount || 0),
        }));
        if (!validateExactSplit(body.amount, exactSplits)) {
          return createErrorResponse(
            new AppError('Exact split amounts must sum to the total amount', 400)
          );
        }
        computedAmountByUserId = new Map(exactSplits.map((s) => [s.userId, s.amount]));
      } else if (body.splitType === 'PERCENTAGE') {
        const computed = calculatePercentageSplit(
          body.amount,
          normalizedSplits.map((s: any) => ({ userId: s.userId, percentage: Number(s.percentage || 0) }))
        );
        computedAmountByUserId = new Map(computed.map((s) => [s.userId, s.amount]));
      } else if (body.splitType === 'SHARES') {
        const computed = calculateSharesSplit(
          body.amount,
          normalizedSplits.map((s: any) => ({ userId: s.userId, shares: Number(s.shares || 0) }))
        );
        if (computed.length === 0) {
          return createErrorResponse(
            new AppError('Shares split requires at least one positive share', 400)
          );
        }
        computedAmountByUserId = new Map(computed.map((s) => [s.userId, s.amount]));
      } else {
        return createErrorResponse(new AppError('Invalid split type', 400));
      }
    } catch (splitError: any) {
      return createErrorResponse(new AppError('Invalid split configuration', 400));
    }

    const splitsToInsert = normalizedSplits.map((split: any) => ({
      expense_id: expense.id,
      user_id: split.userId,
      amount_owed: computedAmountByUserId.get(split.userId) ?? 0,
      percentage_owed: split.percentage,
      shares: split.shares,
    }));

    const { error: splitsError } = await supabaseAdmin
      .from('expense_splits')
      .insert(splitsToInsert);

    if (splitsError) {
      console.error('Error creating splits:', splitsError);
      await supabaseAdmin.from('expenses').delete().eq('id', expense.id);
      return createErrorResponse(new AppError('Failed to create expense splits', 400));
    }

    if (body.receiptCid) {
      await supabaseAdmin.from('shared_media').insert({
        group_id: groupId,
        expense_id: expense.id,
        uploader_id: userId,
        cid: body.receiptCid,
        media_type: 'image',
        title: `Receipt for ${body.description}`,
      });
    }

    // Trigger notifications for all group members except the one who paid
    const { data: members } = await supabaseAdmin
      .from('group_members')
      .select('user_id, groups(name), users!group_members_user_id_fkey(name)')
      .eq('group_id', groupId);

    if (members) {
      const payerName = members.find(m => m.user_id === body.paidById)?.users?.[0]?.name || 'Someone';
      const groupName = (members[0]?.groups as any)?.name || 'the group';

      const notificationPromises = members
        .filter(m => m.user_id !== body.paidById)
        .map(m => 
          notificationService.createNotification({
            userId: m.user_id,
            type: 'expense_added',
            title: 'New Expense',
            message: `${payerName} added "${body.description}" to ${groupName}`,
            data: {
              groupId,
              expenseId: expense.id,
              groupName,
              amount: body.amount,
              currency: body.currency,
            },
          })
        );
      
      Promise.all(notificationPromises).catch(err => console.error('Failed to send expense notifications:', err));
    }

    return createResponse(expense, 201);
  } catch (error) {
    console.error('Error in POST /api/groups/[id]/expenses:', error);
    return createErrorResponse(error);
  }
};

export const GET = withMiddleware(listExpenses, { auth: true });
export const POST = withMiddleware(createExpense, { auth: true, validation: { schema: CreateExpenseApiSchema } });
