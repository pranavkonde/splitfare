import { withMiddleware, createResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { CreateSettlementSchema } from '@/lib/validations';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';

const getSettlements = async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get('groupId');
    const userId = toDbUserId(req.user.id);

    if (!groupId) {
      return createResponse({ error: 'Group ID is required' }, 400);
    }

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return createResponse({ error: 'Access denied' }, 403);
    }

    const { data: settlements, error: fetchError } = await supabaseAdmin
      .from('settlements')
      .select(`
        *,
        payer:users!settlements_payer_id_fkey(id, name, avatar_url),
        payee:users!settlements_payee_id_fkey(id, name, avatar_url)
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching settlements:', fetchError);
      return createResponse({ error: 'Failed to fetch settlements' }, 400);
    }

    return createResponse(settlements);
  } catch (error) {
    console.error('Error in GET /api/settlements:', error);
    return createResponse({ error: 'Internal server error' }, 500);
  }
};

const createSettlement = async (req: AuthenticatedRequest & { validatedBody: any }) => {
  try {
    const { group_id, from_user_id, to_user_id, amount, transaction_hash } = req.validatedBody;
    const userId = toDbUserId(req.user.id);

    if (from_user_id !== userId) {
      return createResponse({ error: 'Unauthorized: payer must be current user' }, 403);
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .in('user_id', [from_user_id, to_user_id]);

    if (membersError || members.length < 2) {
      return createResponse({ error: 'Both users must be members of the group' }, 400);
    }

    const { data: expenses, error: expensesError } = await supabaseAdmin
      .from('expenses')
      .select('id, created_by, total_amount, splits:expense_splits(user_id, amount_owed)')
      .eq('group_id', group_id);

    if (expensesError) throw expensesError;

    const { data: existingSettlements, error: sError } = await supabaseAdmin
      .from('settlements')
      .select('payer_id, payee_id, amount')
      .eq('group_id', group_id)
      .eq('status', 'completed');

    if (sError) throw sError;

    let balanceBetween = 0; 

    expenses.forEach(exp => {
      if (exp.created_by === to_user_id) {
        const split = exp.splits.find((s: any) => s.user_id === from_user_id);
        if (split) balanceBetween += Number(split.amount_owed);
      }
      if (exp.created_by === from_user_id) {
        const split = exp.splits.find((s: any) => s.user_id === to_user_id);
        if (split) balanceBetween -= Number(split.amount_owed);
      }
    });

    existingSettlements.forEach(s => {
      if (s.payer_id === from_user_id && s.payee_id === to_user_id) {
        balanceBetween -= Number(s.amount);
      }
      if (s.payer_id === to_user_id && s.payee_id === from_user_id) {
        balanceBetween += Number(s.amount);
      }
    });

    if (balanceBetween < amount - 0.01) {
      return createResponse({ 
        error: 'Insufficient debt: you only owe ' + balanceBetween.toFixed(2) + ' to this member' 
      }, 400);
    }

    const { data: settlement, error: createError } = await supabaseAdmin
      .from('settlements')
      .insert({
        group_id,
        payer_id: from_user_id,
        payee_id: to_user_id,
        amount,
        status: 'completed',
        tx_hash: transaction_hash,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating settlement:', createError);
      return createResponse({ error: 'Failed to create settlement' }, 400);
    }

    return createResponse(settlement, 201);
  } catch (error) {
    console.error('Error in POST /api/settlements:', error);
    return createResponse({ error: 'Internal server error' }, 500);
  }
};

export const GET = withMiddleware(getSettlements, { auth: true });
export const POST = withMiddleware(createSettlement, { 
  auth: true, 
  validation: { schema: CreateSettlementSchema } 
});
