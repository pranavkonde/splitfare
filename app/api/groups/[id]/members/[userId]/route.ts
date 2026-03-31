import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';
import { createServerStorachaService } from '@/lib/storacha-server';
import { createDelegation } from '@/lib/delegation';


const updateMember = async (req: AuthenticatedRequest & { validatedBody?: any }, { params }: { params: { id: string; userId: string } }) => {
  try {
    const groupId = params.id;
    const targetUserId = params.userId;
    const currentUserId = toDbUserId(req.user.id);
    const { role } = await req.json();

    const { data: currentMembership, error: currentMemberError } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', currentUserId)
      .single();

    if (currentMemberError || !currentMembership || (currentMembership.role !== 'admin' && currentMembership.role !== 'owner')) {
      return createErrorResponse(new ForbiddenError('Unauthorized: Admin or owner role required'));
    }

    if (role === 'owner') {
      if (currentMembership.role !== 'owner') {
        return createErrorResponse(new ForbiddenError('Only the current owner can transfer ownership'));
      }

      const { error: targetUpdateError } = await supabaseAdmin
        .from('group_members')
        .update({ role: 'owner' })
        .eq('group_id', groupId)
        .eq('user_id', targetUserId);

      if (targetUpdateError) {
        return createErrorResponse(new AppError('Failed to update target user role', 400));
      }

      const { error: currentUpdateError } = await supabaseAdmin
        .from('group_members')
        .update({ role: 'admin' })
        .eq('group_id', groupId)
        .eq('user_id', currentUserId);

      if (currentUpdateError) {
        return createErrorResponse(new AppError('Failed to demote current owner', 400));
      }

      return createResponse({ success: true, message: 'Ownership transferred' });
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('group_members')
        .update({ role })
        .eq('group_id', groupId)
        .eq('user_id', targetUserId);

      if (updateError) {
        return createErrorResponse(new AppError('Failed to update member role', 400));
      }

      return createResponse({ success: true, message: `Member role updated to ${role}` });
    }
  } catch (error) {
    console.error('Error in PATCH /api/groups/[id]/members/[userId]:', error);
    return createErrorResponse(error);
  }
};

const removeMember = async (req: AuthenticatedRequest, { params }: { params: { id: string; userId: string } }) => {
  try {
    const groupId = params.id;
    const targetUserId = params.userId;
    const currentUserId = toDbUserId(req.user.id);

    const { data: currentMembership, error: currentMemberError } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', currentUserId)
      .single();

    if (currentMemberError || !currentMembership || (currentMembership.role !== 'admin' && currentMembership.role !== 'owner')) {
      return createErrorResponse(new ForbiddenError('Unauthorized: Admin or owner role required'));
    }

    const { data: targetMembership, error: targetMemberError } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
      .single();

    if (targetMemberError || !targetMembership) {
      return createErrorResponse(new NotFoundError('Target user not found in group'));
    }

    if (targetMembership.role === 'owner') {
      return createErrorResponse(new ForbiddenError('The owner cannot be removed from the group'));
    }

    if (targetMembership.role === 'admin' && currentMembership.role !== 'owner') {
      return createErrorResponse(new ForbiddenError('Only the owner can remove other admins'));
    }

    const { error: deleteError } = await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId);

    if (deleteError) {
        return createErrorResponse(new AppError('Failed to remove member', 400));
      }

      try {
        await supabaseAdmin
          .from('group_members')
          .update({ ucan_proof: null })
          .eq('group_id', groupId)
          .eq('user_id', targetUserId);
      } catch (revokeError) {
        console.error('Failed to revoke UCAN delegation during removal:', revokeError);
      }


    return createResponse({ success: true, message: 'Member removed' });
  } catch (error) {
    console.error('Error in DELETE /api/groups/[id]/members/[userId]:', error);
    return createErrorResponse(error);
  }
};

export const PATCH = withMiddleware(updateMember, { auth: true });
export const DELETE = withMiddleware(removeMember, { auth: true });
