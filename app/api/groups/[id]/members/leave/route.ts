import { withMiddleware, createResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';


const leaveGroup = async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const groupId = params.id;
    const userId = toDbUserId(req.user.id);

    // 1. Get membership and group info
    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('role, groups(created_by)')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return createResponse({ error: 'User is not a member of the group' }, 404);
    }

    const group = (membership as any).groups;
    if (group?.created_by === userId) {
      return createResponse({ error: 'Group owners must transfer ownership before leaving' }, 403);
    }

    // 2. Check for outstanding balance
    // Balance = (Total Paid by User) - (Total Owed by User) + (Settlements Paid by User) - (Settlements Received by User)
    
    // Total Paid (as expense creator)
    const { data: totalPaidData, error: paidError } = await supabaseAdmin
      .from('expenses')
      .select('total_amount')
      .eq('group_id', groupId)
      .eq('created_by', userId);

    if (paidError) throw paidError;
    const totalPaid = totalPaidData?.reduce((sum, exp) => sum + Number(exp.total_amount), 0) || 0;

    // Total Owed (from splits)
    const { data: totalOwedData, error: owedError } = await supabaseAdmin
      .from('expense_splits')
      .select('amount_owed, expenses!inner(group_id)')
      .eq('user_id', userId)
      .eq('expenses.group_id', groupId);

    if (owedError) throw owedError;
    const totalOwed = totalOwedData?.reduce((sum, split) => sum + Number(split.amount_owed), 0) || 0;

    // Settlements Paid
    const { data: sPaidData, error: sPaidError } = await supabaseAdmin
      .from('settlements')
      .select('amount')
      .eq('group_id', groupId)
      .eq('payer_id', userId)
      .eq('status', 'completed');

    if (sPaidError) throw sPaidError;
    const totalSettlementsPaid = sPaidData?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

    // Settlements Received
    const { data: sReceivedData, error: sReceivedError } = await supabaseAdmin
      .from('settlements')
      .select('amount')
      .eq('group_id', groupId)
      .eq('payee_id', userId)
      .eq('status', 'completed');

    if (sReceivedError) throw sReceivedError;
    const totalSettlementsReceived = sReceivedData?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

    const netBalance = totalPaid - totalOwed + totalSettlementsPaid - totalSettlementsReceived;

    if (Math.abs(netBalance) > 0.01) {
      return createResponse({ 
        error: 'You cannot leave the group until your balance is zero', 
        balance: Math.round(netBalance * 100) / 100 
      }, 400);
    }

    // 3. Delete membership
    const { error: deleteError } = await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (deleteError) {
      return createResponse({ error: 'Failed to leave group' }, 400);
    }

    return createResponse({ success: true, message: 'Left group successfully' });
  } catch (error) {
    console.error('Error in POST /api/groups/[id]/members/leave:', error);
    return createResponse({ error: 'Internal server error' }, 500);
  }
};

export const POST = withMiddleware(leaveGroup, { auth: true });
