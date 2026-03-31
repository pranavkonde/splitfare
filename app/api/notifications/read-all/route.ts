import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { notificationService } from '@/services/notification';
import { toDbUserId } from '@/lib/privy-utils';

const markAllAsRead = async (req: AuthenticatedRequest) => {
  try {
    const userId = toDbUserId(req.user.id);
    await notificationService.markAllAsRead(userId);
    return createResponse({ success: true });
  } catch (error) {
    console.error('Error in POST /api/notifications/read-all:', error);
    return createErrorResponse(error);
  }
};

export const POST = withMiddleware(markAllAsRead, { auth: true });
