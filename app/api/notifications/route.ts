import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { notificationService } from '@/services/notification';
import { toDbUserId } from '@/lib/privy-utils';

const getNotifications = async (req: AuthenticatedRequest) => {
  try {
    const userId = toDbUserId(req.user.id);
    const notifications = await notificationService.getUserNotifications(userId);
    return createResponse(notifications);
  } catch (error) {
    console.error('Error in GET /api/notifications:', error);
    return createErrorResponse(error);
  }
};

export const GET = withMiddleware(getNotifications, { auth: true });
