import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';
import { CreateMediaSchema, MediaFilterSchema } from '@/lib/validations/media';
import { ForbiddenError, AppError } from '@/lib/errors';

const listMedia = async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
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
      return createErrorResponse(new ForbiddenError('Access denied'));
    }

    const filterParams = {
      limit: parseInt(searchParams.get('limit') || '20'),
      cursor: searchParams.get('cursor') || undefined,
    };

    const validatedFilters = MediaFilterSchema.parse(filterParams);

    let query = supabaseAdmin
      .from('shared_media')
      .select(`
        *,
        uploader:users!shared_media_uploader_id_fkey(id, name, avatar_url),
        expense:expenses(id, description, total_amount, currency)
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(validatedFilters.limit);

    if (validatedFilters.cursor) {
      query = query.lt('created_at', validatedFilters.cursor);
    }

    const { data: media, error } = await query;

    if (error) {
      console.error('List media query error:', error);
      return createErrorResponse(new AppError('Failed to fetch media', 500));
    }

    const nextCursor = media.length === validatedFilters.limit 
      ? media[media.length - 1].created_at 
      : null;

    return createResponse({ data: media, nextCursor });
  } catch (err) {
    return createErrorResponse(err);
  }
};

const createMedia = async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const groupId = params.id;
    const userId = toDbUserId(req.user.id);
    const body = await req.json();

    const validatedData = CreateMediaSchema.parse(body);

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return createErrorResponse(new ForbiddenError('Access denied'));
    }

    const { data: media, error: insertError } = await supabaseAdmin
      .from('shared_media')
      .insert({
        group_id: groupId,
        uploader_id: userId,
        cid: validatedData.cid,
        media_type: validatedData.media_type,
        title: validatedData.title,
        expense_id: validatedData.expense_id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert media error:', insertError);
      return createErrorResponse(new AppError('Failed to save media', 500));
    }

    return createResponse({ data: media }, 201);
  } catch (err) {
    return createErrorResponse(err);
  }
};

export const GET = withMiddleware(listMedia, { auth: true });
export const POST = withMiddleware(createMedia, { auth: true });
