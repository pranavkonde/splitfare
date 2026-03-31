import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { ForbiddenError, AppError } from '@/lib/errors';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';
import { calculateBalances } from '@/lib/calculations';

const getGroupMembers = async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const groupId = params.id;
    const userId = toDbUserId(req.user.id);

    const { data: membership, error: memberCheckError } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberCheckError || !membership) {
      return createErrorResponse(new ForbiddenError('Unauthorized'));
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from('group_members')
      .select(`
        id,
        role,
        joined_at,
        user:users (
          id,
          name,
          username,
          ens_name,
          avatar_url,
          wallet_address
        )
      `)
      .eq('group_id', groupId);

    if (membersError) {
      console.error('Error fetching group members:', membersError);
      return createErrorResponse(new AppError('Failed to fetch members', 500));
    }

    let { data: expenses, error: expensesError } = await supabaseAdmin
      .from('expenses')
      .select(`
        id,
        total_amount,
        created_by,
        splits:expense_splits(user_id, amount_owed)
      `)
      .eq('group_id', groupId)
      .is('deleted_at', null);

    if (expensesError && (expensesError as any).code === '42703') {
      const fallback = await supabaseAdmin
        .from('expenses')
        .select(`
          id,
          total_amount,
          created_by,
          splits:expense_splits(user_id, amount_owed)
        `)
        .eq('group_id', groupId);
      expenses = fallback.data as any;
      expensesError = fallback.error as any;
    }

    if (expensesError) {
      console.error('Error fetching expenses for balance:', expensesError);
      return createErrorResponse(new AppError('Failed to fetch balances', 500));
    }

    const { data: settlements, error: settlementsError } = await supabaseAdmin
      .from('settlements')
      .select('payer_id, payee_id, amount')
      .eq('group_id', groupId)
      .eq('status', 'completed');

    if (settlementsError) {
      console.error('Error fetching settlements for balance:', settlementsError);
      return createErrorResponse(new AppError('Failed to fetch balances', 500));
    }

    const balances = calculateBalances(
      members as any[],
      expenses as any[],
      settlements as any[]
    );

    const membersWithBalances = members.map(m => {
      const user = m.user as any;
      return {
        ...m,
        balance: user?.id ? (balances[user.id] || 0) : 0
      };
    });

    return createResponse(membersWithBalances);
  } catch (error) {
    console.error('Error in GET /api/groups/[id]/members:', error);
    return createErrorResponse(error);
  }
};

export const GET = withMiddleware(getGroupMembers, { auth: true });
