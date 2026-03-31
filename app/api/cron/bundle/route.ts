import { timingSafeEqual } from 'node:crypto';
import { createBundleScheduler } from '@/services/bundle-scheduler';
import { createResponse, createErrorResponse } from '@/lib/api-utils';
import { AppError, AuthenticationError } from '@/lib/errors';

function timingSafeBearerMatch(header: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const h = header ?? '';
  const a = Buffer.from(h, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const GET = async (req: Request) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      const secret = process.env.CRON_SECRET;
      if (!secret || secret.length < 16) {
        console.error('[CRON] CRON_SECRET is missing or shorter than 16 characters');
        return createErrorResponse(
          new AppError('Scheduled jobs are not configured', 503, 'CRON_MISCONFIGURED')
        );
      }
      if (!timingSafeBearerMatch(req.headers.get('Authorization'), secret)) {
        return createErrorResponse(new AuthenticationError('Unauthorized cron request'));
      }
    }

    const scheduler = await createBundleScheduler();
    await scheduler.runScheduledBundling();

    return createResponse({ message: 'Scheduled bundling pipeline triggered' });
  } catch (error) {
    console.error('[CRON] Bundling pipeline failed:', error);
    return createErrorResponse(error);
  }
};
