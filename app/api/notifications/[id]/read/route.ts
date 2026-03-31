import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { notificationService } from '@/services/notification';
import { toDbUserId } from '@/lib/privy-utils';

const markAsRead = async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const userId = toDbUserId(req.user.id);
    const notificationId = params.id;
    await notificationService.markAsRead(notificationId, userId);
    return createResponse({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/notifications/[id]/read:', error);
    return createErrorResponse(error);
  }
};

export const PATCH = withMiddleware(markAsRead, { auth: true });
