import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';
import { NotFoundError, ForbiddenError, AppError } from '@/lib/errors';

const deleteMedia = async (req: AuthenticatedRequest, { params }: { params: { id: string, mediaId: string } }) => {
  try {
    const groupId = params.id;
    const mediaId = params.mediaId;
    const userId = toDbUserId(req.user.id);

    const { data: media, error: mediaError } = await supabaseAdmin
      .from('shared_media')
      .select('uploader_id')
      .eq('id', mediaId)
      .eq('group_id', groupId)
      .single();

    if (mediaError || !media) {
      return createErrorResponse(new NotFoundError('Media not found'));
    }

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return createErrorResponse(new ForbiddenError('Access denied'));
    }

    const isAdmin = membership.role === 'admin';
    const isUploader = media.uploader_id === userId;

    if (!isAdmin && !isUploader) {
      return createErrorResponse(new ForbiddenError('Only the uploader or an admin can delete media'));
    }

    const { error: deleteError } = await supabaseAdmin
      .from('shared_media')
      .delete()
      .eq('id', mediaId);

    if (deleteError) {
      console.error('Delete media error:', deleteError);
      return createErrorResponse(new AppError('Failed to delete media', 500));
    }

    return createResponse({ message: 'Media deleted successfully' });
  } catch (err) {
    return createErrorResponse(err);
  }
};

export const DELETE = withMiddleware(deleteMedia, { auth: true });
