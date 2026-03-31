import { withMiddleware, createResponse, createErrorResponse } from '@/lib/api-utils';
import { NotFoundError } from '@/lib/errors';
import { supabaseAdmin } from '@/supabase/admin';

const getGroupByInviteCode = async (req: Request, { params }: { params: { code: string } }) => {
  try {
    const { code } = params;

    const { data: group, error } = await supabaseAdmin
      .from('groups')
      .select(`
        id,
        name,
        description,
        category,
        avatar_url,
        member_count:group_members(count)
      `)
      .eq('invite_code', code)
      .single();

    if (error || !group) {
      console.error('Error fetching group by invite code:', error);
      return createErrorResponse(new NotFoundError('Invalid invite code'));
    }

    const formattedGroup = {
      ...group,
      member_count: group.member_count?.[0]?.count || 0
    };

    return createResponse(formattedGroup);
  } catch (error) {
    console.error('Error in GET /api/groups/invite/[code]:', error);
    return createErrorResponse(error);
  }
};

export const GET = withMiddleware(getGroupByInviteCode, { auth: false });
