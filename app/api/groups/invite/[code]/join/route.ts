import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { AppError, NotFoundError } from '@/lib/errors';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';
import { createServerStorachaService } from '@/lib/storacha-server';
import { createDelegation } from '@/lib/delegation';
import { notificationService } from '@/services/notification';

const joinGroupByInviteCode = async (req: AuthenticatedRequest, { params }: { params: { code: string } }) => {
  try {
    const { code } = params;
    const userId = toDbUserId(req.user.id);

    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id, space_did')
      .eq('invite_code', code)
      .single();

    if (groupError || !group) {
      return createErrorResponse(new NotFoundError('Invalid invite code'));
    }

    const { data: existingMember, error: memberCheckError } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      return createErrorResponse(
        new AppError('Already a member', 400, 'ALREADY_MEMBER', { groupId: group.id })
      );
    }

    const { error: joinError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: userId,
        role: 'member',
      });

    if (joinError) {
      console.error('Error joining group:', joinError);
      return createErrorResponse(new AppError('Failed to join group', 500));
    }

    if (group.space_did) {
      try {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('wallet_address')
          .eq('id', userId)
          .single();

        if (userData?.wallet_address) {
          const storacha = await createServerStorachaService();
          const delegation = await createDelegation(
            storacha,
            group.space_did,
            `did:pkh:eip155:1:${userData.wallet_address}`,
            'member'
          );

          await supabaseAdmin
            .from('group_members')
            .update({ ucan_proof: delegation })
            .eq('group_id', group.id)
            .eq('user_id', userId);
        }
      } catch (delegationError) {
        console.error('Graceful fallback: UCAN delegation failed during join:', delegationError);
      }
    }

    // Trigger notification for group members
    const { data: members } = await supabaseAdmin
      .from('group_members')
      .select('user_id, groups(name), users!group_members_user_id_fkey(name)')
      .eq('group_id', group.id);

    if (members) {
      const joinedUser = members.find(m => m.user_id === userId);
      const joinedUserName = (joinedUser?.users as any)?.name || 'Someone';
      const groupName = (members[0]?.groups as any)?.name || 'the group';

      const notificationPromises = members
        .filter(m => m.user_id !== userId)
        .map(m => 
          notificationService.createNotification({
            userId: m.user_id,
            type: 'member_joined',
            title: 'New Member',
            message: `${joinedUserName} joined ${groupName}`,
            data: {
              groupId: group.id,
              groupName,
              senderId: userId,
              senderName: joinedUserName,
            },
          })
        );
      
      Promise.all(notificationPromises).catch(err => console.error('Failed to send join notifications:', err));
    }

    return createResponse({ success: true, groupId: group.id }, 200);
  } catch (error) {
    console.error('Error in POST /api/groups/invite/[code]/join:', error);
    return createErrorResponse(error);
  }
};

export const POST = withMiddleware(joinGroupByInviteCode, { auth: true });
