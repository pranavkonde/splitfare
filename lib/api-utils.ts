import { NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { PrivyClient } from '@privy-io/node';
import { AppError, ValidationError, AuthenticationError } from './errors';

const privyAppId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;

declare global {
  var __splitfarePrivyEnvWarned: boolean | undefined;
}

if (!privyAppId || !privyAppSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: PRIVY_APP_ID and PRIVY_APP_SECRET must be configured in production. ' +
      'API auth cannot fall back to unsigned JWT decode in production.'
    );
  }
  if (!globalThis.__splitfarePrivyEnvWarned) {
    console.warn(
      "PRIVY_APP_SECRET (and app id) are not set. API auth falls back to unsigned JWT decode only — use Privy verify in production."
    );
    globalThis.__splitfarePrivyEnvWarned = true;
  }
}

function getServerPrivyClient(): PrivyClient | null {
  if (!privyAppId || !privyAppSecret) {
    return null;
  }
  const jwtVerificationKey = process.env.PRIVY_JWT_VERIFICATION_KEY;
  return new PrivyClient({
    appId: privyAppId,
    appSecret: privyAppSecret,
    ...(jwtVerificationKey ? { jwtVerificationKey } : {}),
  });
}

export type ApiResponse<T = any> = {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  };
} | {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
};

export const createResponse = <T>(
  data: T,
  statusCode: number = 200,
  meta?: any
): NextResponse<ApiResponse<T>> => {
  return NextResponse.json(
    {
      success: true,
      data,
      meta,
    },
    { status: statusCode }
  );
};

export const createErrorResponse = (error: unknown): NextResponse<ApiResponse> => {
  if (error instanceof AppError) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }

  if (error instanceof ZodError) {
    const validationError = new ValidationError('Validation failed', error.errors);
    return NextResponse.json(validationError.toJSON(), { status: 400 });
  }

  console.error('[API] Unhandled error:', error);
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error instanceof Error
        ? error.message
        : 'An unexpected error occurred';
  const internalError = new AppError(message);
  return NextResponse.json(internalError.toJSON(), { status: 500 });
};

export const logger = (
  method: string,
  path: string,
  status: number,
  duration: number
) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${method} ${path} ${status} - ${duration}ms`);
};

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    [key: string]: any;
  };
};

export type ApiHandler<T = Request> = (req: T, context?: any) => Promise<NextResponse> | NextResponse;

import * as jose from 'jose';

export const withAuth = (handler: ApiHandler<AuthenticatedRequest>) => {
  return async (req: Request, context?: any) => {
    try {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Missing or invalid authorization header');
      }

      const token = authHeader.slice('Bearer '.length).trim();
      if (!token || token === 'undefined' || token === 'null') {
        throw new AuthenticationError('Missing or invalid authorization header');
      }

      const authReq = req as AuthenticatedRequest;
      const privy = getServerPrivyClient();

      if (privy) {
        try {
          const verified = await privy.utils().auth().verifyAccessToken(token);
          authReq.user = { id: verified.user_id };
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Invalid authentication token';
          throw new AuthenticationError(msg);
        }
      } else {
        try {
          const payload = jose.decodeJwt(token);
          const sub = payload.sub;
          if (!sub || typeof sub !== 'string') {
            throw new AuthenticationError('Invalid token payload');
          }
          authReq.user = { id: sub };
        } catch (err) {
          if (err instanceof AuthenticationError) {
            throw err;
          }
          const msg =
            err instanceof Error ? err.message : 'Invalid JWT';
          throw new AuthenticationError(msg);
        }
      }

      return await handler(authReq, context);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
};


export const withValidation = <T>(schema: ZodSchema<T>, handler: ApiHandler<Request & { validatedBody: T }>) => {
  return async (req: Request, context?: any) => {
    try {
      const body = await req.json();
      const validatedBody = schema.parse(body);
      
      const validatedReq = req as Request & { validatedBody: T };
      validatedReq.validatedBody = validatedBody;
      
      return await handler(validatedReq, context);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
};

import { checkRateLimit } from './rate-limit';
import { getRateLimitIdentifier } from './client-ip';


export const withMiddleware = <T = Request>(handler: ApiHandler<T>, options?: { auth?: boolean; validation?: { schema: ZodSchema }; rateLimit?: boolean }) => {
  return async (req: Request, context?: any) => {
    const start = Date.now();
    let response: NextResponse;

    try {
      if (options?.rateLimit !== false) {
        await checkRateLimit(getRateLimitIdentifier(req));
      }

      let finalHandler: ApiHandler<any> = handler;

      // Inner handler first; outer wrappers run first at request time. Compose so that
      // auth runs before body validation (smaller attack surface for unauthenticated requests).
      if (options?.validation) {
        finalHandler = withValidation(options.validation.schema, finalHandler);
      }

      if (options?.auth) {
        finalHandler = withAuth(finalHandler as ApiHandler<AuthenticatedRequest>);
      }

      response = await (finalHandler as ApiHandler<Request>)(req, context);
    } catch (error) {
      response = createErrorResponse(error);
    }

    const duration = Date.now() - start;
    const { pathname } = new URL(req.url);
    logger(req.method, pathname, response.status, duration);

    return response;
  };
};
