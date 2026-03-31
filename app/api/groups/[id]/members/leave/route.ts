import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';


const leaveGroup = async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const groupId = params.id;
    const userId = toDbUserId(req.user.id);

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('role, groups(created_by)')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return createErrorResponse(new NotFoundError('User is not a member of the group'));
    }

    const group = (membership as any).groups;
    if (group?.created_by === userId) {
      return createErrorResponse(
        new ForbiddenError('Group owners must transfer ownership before leaving')
      );
    }


    let { data: totalPaidData, error: paidError } = await supabaseAdmin
      .from('expenses')
      .select('total_amount')
      .eq('group_id', groupId)
      .eq('created_by', userId)
      .is('deleted_at', null);

    if (paidError && (paidError as any).code === '42703') {
      const fallbackPaid = await supabaseAdmin
        .from('expenses')
        .select('total_amount')
        .eq('group_id', groupId)
        .eq('created_by', userId);
      totalPaidData = fallbackPaid.data;
      paidError = fallbackPaid.error;
    }

    if (paidError) throw paidError;
    const totalPaid = totalPaidData?.reduce((sum, exp) => sum + Number(exp.total_amount), 0) || 0;

    let { data: totalOwedData, error: owedError } = await supabaseAdmin
      .from('expense_splits')
      .select('amount_owed, expenses!inner(group_id, deleted_at)')
      .eq('user_id', userId)
      .eq('expenses.group_id', groupId)
      .is('expenses.deleted_at', null);

    if (owedError && (owedError as any).code === '42703') {
      const fallbackOwed = await supabaseAdmin
        .from('expense_splits')
        .select('amount_owed, expenses!inner(group_id)')
        .eq('user_id', userId)
        .eq('expenses.group_id', groupId);
      totalOwedData = fallbackOwed.data as any;
      owedError = fallbackOwed.error as any;
    }

    if (owedError) throw owedError;
    const totalOwed = totalOwedData?.reduce((sum, split) => sum + Number(split.amount_owed), 0) || 0;

    const { data: sPaidData, error: sPaidError } = await supabaseAdmin
      .from('settlements')
      .select('amount')
      .eq('group_id', groupId)
      .eq('payer_id', userId)
      .eq('status', 'completed');

    if (sPaidError) throw sPaidError;
    const totalSettlementsPaid = sPaidData?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

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
      return createErrorResponse(
        new AppError('You cannot leave the group until your balance is zero', 400, 'NONZERO_BALANCE', {
          balance: Math.round(netBalance * 100) / 100,
        })
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (deleteError) {
      return createErrorResponse(new AppError('Failed to leave group', 400));
    }

    try {
      await supabaseAdmin
        .from('group_members')
        .update({ ucan_proof: null })
        .eq('group_id', groupId)
        .eq('user_id', userId);
    } catch (revokeError) {
      console.error('Failed to revoke UCAN delegation during leave:', revokeError);
    }

    return createResponse({ success: true, message: 'Left group successfully' });
  } catch (error) {
    console.error('Error in POST /api/groups/[id]/members/leave:', error);
    return createErrorResponse(error);
  }
};

export const POST = withMiddleware(leaveGroup, { auth: true });
