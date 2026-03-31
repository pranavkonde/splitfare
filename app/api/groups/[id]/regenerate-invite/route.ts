import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { AppError, ForbiddenError } from '@/lib/errors';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';
import { nanoid } from 'nanoid';

const regenerateInviteCode = async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const { id: groupId } = params;
    const userId = toDbUserId(req.user.id);

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership || membership.role !== 'admin') {
      return createErrorResponse(new ForbiddenError('Only admins can regenerate invite codes'));
    }

    const newCode = nanoid(8);

    const { data: group, error: updateError } = await supabaseAdmin
      .from('groups')
      .update({ invite_code: newCode })
      .eq('id', groupId)
      .select('id, name, invite_code')
      .single();

    if (updateError) {
      console.error('Error updating invite code:', updateError);
      return createErrorResponse(new AppError('Failed to regenerate invite code', 500));
    }

    return createResponse(group);
  } catch (error) {
    console.error('Error in POST /api/groups/[id]/regenerate-invite:', error);
    return createErrorResponse(error);
  }
};

export const POST = withMiddleware(regenerateInviteCode, { auth: true });
