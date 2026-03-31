import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { ForbiddenError, NotFoundError, AppError } from '@/lib/errors';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';
import { UpdateExpenseApiSchema } from '@/lib/validations/expense';

const getExpenseDetail = async (req: AuthenticatedRequest, { params }: { params: { id: string, expenseId: string } }) => {
  try {
    const { id: groupId, expenseId } = params;
    const userId = toDbUserId(req.user.id);

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return createErrorResponse(new ForbiddenError('Access denied'));
    }

    const detailSelect = `
      *,
      paidBy:users!expenses_created_by_fkey(id, name, avatar_url),
      splits:expense_splits(
        id,
        user_id,
        amount_owed,
        percentage_owed,
        shares,
        user:users!expense_splits_user_id_fkey(id, name, avatar_url)
      ),
      receipts:shared_media(cid, media_type, title)
    `;

    const runDetailQuery = (filterDeleted: boolean) => {
      let q = supabaseAdmin
        .from('expenses')
        .select(detailSelect)
        .eq('id', expenseId)
        .eq('group_id', groupId);
      if (filterDeleted) {
        q = q.is('deleted_at', null);
      }
      return q.single();
    };

    let { data: expense, error: fetchError } = await runDetailQuery(true);

    if (fetchError && (fetchError as { code?: string }).code === '42703') {
      const retry = await runDetailQuery(false);
      expense = retry.data;
      fetchError = retry.error;
    }

    if (fetchError || !expense) {
      return createErrorResponse(new NotFoundError('Expense not found'));
    }

    return createResponse(expense);
  } catch (error) {
    console.error('Error in GET /api/groups/[id]/expenses/[expenseId]:', error);
    return createErrorResponse(error);
  }
};

const updateExpense = async (req: AuthenticatedRequest & { validatedBody: any }, { params }: { params: { id: string, expenseId: string } }) => {
  try {
    const { id: groupId, expenseId } = params;
    const userId = toDbUserId(req.user.id);
    const body = req.validatedBody;

    const { data: expense, error: fetchError } = await supabaseAdmin
      .from('expenses')
      .select('created_by')
      .eq('id', expenseId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !expense) {
      return createErrorResponse(new NotFoundError('Expense not found'));
    }

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership || (expense.created_by !== userId && membership.role !== 'admin')) {
      return createErrorResponse(new ForbiddenError('Unauthorized to edit this expense'));
    }

    const { data: updatedExpense, error: updateError } = await supabaseAdmin
      .from('expenses')
      .update({
        description: body.description,
        total_amount: body.amount,
        category: body.category,
        split_type: body.splitType?.toLowerCase(),
        created_at: body.date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', expenseId)
      .select()
      .single();

    if (updateError) {
      return createErrorResponse(new AppError('Failed to update expense', 400));
    }

    if (body.splits) {
      await supabaseAdmin.from('expense_splits').delete().eq('expense_id', expenseId);
      
      const splitsToInsert = body.splits.map((split: any) => ({
        expense_id: expenseId,
        user_id: split.userId,
        amount_owed: split.amount,
        percentage_owed: split.percentage,
        shares: split.shares,
      }));

      const { error: splitsError } = await supabaseAdmin
        .from('expense_splits')
        .insert(splitsToInsert);

      if (splitsError) {
        return createErrorResponse(new AppError('Failed to update splits', 400));
      }
    }

    if (body.receiptCid) {
      await supabaseAdmin.from('shared_media').delete().eq('expense_id', expenseId);
      await supabaseAdmin.from('shared_media').insert({
        group_id: groupId,
        expense_id: expenseId,
        uploader_id: userId,
        cid: body.receiptCid,
        media_type: 'image',
        title: `Receipt for ${body.description || updatedExpense.description}`,
      });
    }

    return createResponse(updatedExpense);
  } catch (error) {
    console.error('Error in PATCH /api/groups/[id]/expenses/[expenseId]:', error);
    return createErrorResponse(error);
  }
};

const deleteExpense = async (req: AuthenticatedRequest, { params }: { params: { id: string, expenseId: string } }) => {
  try {
    const { id: groupId, expenseId } = params;
    const userId = toDbUserId(req.user.id);

    const { data: expense, error: fetchError } = await supabaseAdmin
      .from('expenses')
      .select('created_by')
      .eq('id', expenseId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !expense) {
      return createErrorResponse(new NotFoundError('Expense not found'));
    }

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership || (expense.created_by !== userId && membership.role !== 'admin')) {
      return createErrorResponse(new ForbiddenError('Unauthorized to delete this expense'));
    }

    const { error: deleteError } = await supabaseAdmin
      .from('expenses')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', expenseId);

    if (deleteError) {
      return createErrorResponse(new AppError('Failed to delete expense', 400));
    }

    return createResponse({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/groups/[id]/expenses/[expenseId]:', error);
    return createErrorResponse(error);
  }
};

export const GET = withMiddleware(getExpenseDetail, { auth: true });
export const PATCH = withMiddleware(updateExpense, { auth: true, validation: { schema: UpdateExpenseApiSchema } });
export const DELETE = withMiddleware(deleteExpense, { auth: true });
