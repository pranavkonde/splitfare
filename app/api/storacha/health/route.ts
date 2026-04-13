import { NextResponse } from 'next/server';
import { createServerStorachaService } from '@/lib/storacha-server';

/**
 * GET /api/storacha/health
 *
 * Health check endpoint to verify Storacha connectivity.
 * Returns the status of the Storacha service and optionally tests
 * a small upload + retrieval cycle.
 *
 * Query params:
 *   ?deep=true  — perform a full upload+retrieval test (slow, ~5s)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get('deep') === 'true';

  const result: {
    status: 'connected' | 'misconfigured' | 'unreachable';
    agent?: string;
    space?: string;
    testCid?: string;
    testRetrieved?: boolean;
    error?: string;
    envConfigured: boolean;
    timestamp: string;
  } = {
    status: 'unreachable',
    envConfigured: Boolean(
      (process.env.STORACHA_KEY?.trim() || process.env.STORACHA_PRINCIPAL?.trim()) &&
      process.env.STORACHA_PROOF?.trim()
    ),
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Initialize the service
    const storacha = await createServerStorachaService();

    // If we get here, the service was created successfully
    result.status = 'connected';

    // 2. Deep test: upload a small JSON blob and verify retrieval
    if (deep) {
      try {
        const testData = {
          _test: true,
          app: 'splitfare',
          timestamp: Date.now(),
        };
        const cid = await storacha.uploadJson(testData);
        result.testCid = cid;

        // Verify gateway retrieval
        const gatewayUrl = storacha.gatewayUrl(cid);
        const res = await fetch(gatewayUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10_000),
        });
        result.testRetrieved = res.ok;
      } catch (uploadError: any) {
        // Upload failed but service initialized — likely a space/delegation issue
        result.status = 'misconfigured';
        result.error = `Upload test failed: ${uploadError.message}`;
      }
    }

    return NextResponse.json(result, { status: result.status === 'connected' ? 200 : 503 });
  } catch (error: any) {
    if (!result.envConfigured) {
      result.status = 'misconfigured';
      result.error =
        'STORACHA_KEY and STORACHA_PROOF are not configured. ' +
        'Run ./scripts/setup-storacha.sh or see https://docs.storacha.network/how-to/upload/#bring-your-own-delegations';
    } else {
      result.status = 'unreachable';
      result.error = error.message;
    }

    return NextResponse.json(result, { status: 503 });
  }
}
