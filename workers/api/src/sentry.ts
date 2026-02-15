/**
 * Lightweight Sentry Error Tracking for Cloudflare Workers
 *
 * Uses the Sentry HTTP API directly instead of a full SDK, since
 * Cloudflare Workers have a constrained runtime (no Node.js, limited
 * globals). This keeps the bundle small and avoids compatibility issues.
 *
 * PRIVACY: All PII is stripped before sending. Same scrubbing rules
 * as the main client - no pubkeys, no IPs, no message content.
 */

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface SentryEnvelope {
  dsn: string;
  event: SentryWorkerEvent;
}

interface SentryWorkerEvent {
  event_id: string;
  timestamp: number;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  platform: 'javascript';
  server_name?: string;
  environment?: string;
  release?: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename?: string;
          function?: string;
          lineno?: number;
          colno?: number;
        }>;
      };
    }>;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  };
}

// --------------------------------------------------------------------------
// PII Scrubbing (same patterns as main client)
// --------------------------------------------------------------------------

const PII_PATTERNS = {
  PUBKEY_HEX: /\b[0-9a-f]{64}\b/gi,
  NOSTR_BECH32: /\b(npub|nsec|note|nprofile|nevent|naddr)1[0-9a-z]{6,}\b/gi,
  IPV4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  IPV6: /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
} as const;

function scrubString(input: string): string {
  let result = input;
  result = result.replace(PII_PATTERNS.PUBKEY_HEX, (match) => `${match.slice(0, 8)}...`);
  result = result.replace(PII_PATTERNS.NOSTR_BECH32, (match) => {
    const prefix = match.slice(0, match.indexOf('1') + 1);
    return `${prefix}[REDACTED]`;
  });
  result = result.replace(PII_PATTERNS.IPV4, '[IP_REDACTED]');
  result = result.replace(PII_PATTERNS.IPV6, '[IP_REDACTED]');
  result = result.replace(PII_PATTERNS.EMAIL, '[EMAIL_REDACTED]');
  return result;
}

// --------------------------------------------------------------------------
// DSN Parsing
// --------------------------------------------------------------------------

interface ParsedDsn {
  protocol: string;
  publicKey: string;
  host: string;
  projectId: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace('/', '');
    return {
      protocol: url.protocol.replace(':', ''),
      publicKey,
      host: url.hostname,
      projectId,
    };
  } catch {
    return null;
  }
}

function getSentryIngestUrl(parsed: ParsedDsn): string {
  return `${parsed.protocol}://${parsed.host}/api/${parsed.projectId}/store/?sentry_key=${parsed.publicKey}&sentry_version=7`;
}

// --------------------------------------------------------------------------
// UUID Generation (without crypto.randomUUID for Workers compat)
// --------------------------------------------------------------------------

function generateEventId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --------------------------------------------------------------------------
// Worker Sentry Client
// --------------------------------------------------------------------------

export interface WorkerSentryConfig {
  /** Sentry DSN */
  dsn?: string;
  /** Environment name */
  environment?: string;
  /** Release/version string */
  release?: string;
  /** Worker name for server_name tag */
  workerName?: string;
}

/**
 * Lightweight Sentry client for Cloudflare Workers.
 *
 * Usage:
 * ```ts
 * const sentry = new WorkerSentry({
 *   dsn: env.SENTRY_DSN,
 *   environment: 'production',
 *   workerName: 'buildit-api',
 * });
 *
 * try {
 *   // handle request
 * } catch (error) {
 *   await sentry.captureException(error, request);
 *   return new Response('Internal Error', { status: 500 });
 * }
 * ```
 */
export class WorkerSentry {
  private readonly parsedDsn: ParsedDsn | null;
  private readonly config: WorkerSentryConfig;

  constructor(config: WorkerSentryConfig) {
    this.config = config;
    this.parsedDsn = config.dsn ? parseDsn(config.dsn) : null;
  }

  /**
   * Whether Sentry is configured and ready to send events.
   */
  get isEnabled(): boolean {
    return this.parsedDsn !== null;
  }

  /**
   * Capture an exception and send it to Sentry.
   *
   * This method is safe to call even if Sentry is not configured -
   * it will silently no-op.
   *
   * @param error - The error to capture
   * @param request - Optional request object for context (PII stripped)
   * @param extra - Optional extra context (PII scrubbed)
   */
  async captureException(
    error: unknown,
    request?: Request,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.parsedDsn) return;

    const err = error instanceof Error ? error : new Error(String(error));

    const event = this.buildEvent(err, 'error', request, extra);
    await this.send(event);
  }

  /**
   * Capture a message at a specific severity level.
   */
  async captureMessage(
    message: string,
    level: SentryWorkerEvent['level'] = 'info',
    request?: Request,
  ): Promise<void> {
    if (!this.parsedDsn) return;

    const event: SentryWorkerEvent = {
      event_id: generateEventId(),
      timestamp: Date.now() / 1000,
      level,
      platform: 'javascript',
      server_name: this.config.workerName,
      environment: this.config.environment,
      release: this.config.release,
      exception: {
        values: [
          {
            type: 'Message',
            value: scrubString(message),
          },
        ],
      },
      tags: {
        worker: this.config.workerName || 'unknown',
      },
    };

    if (request) {
      event.request = this.scrubRequest(request);
    }

    await this.send(event);
  }

  /**
   * Build a Sentry event from an Error object.
   */
  private buildEvent(
    error: Error,
    level: SentryWorkerEvent['level'],
    request?: Request,
    extra?: Record<string, unknown>,
  ): SentryWorkerEvent {
    const event: SentryWorkerEvent = {
      event_id: generateEventId(),
      timestamp: Date.now() / 1000,
      level,
      platform: 'javascript',
      server_name: this.config.workerName,
      environment: this.config.environment,
      release: this.config.release,
      exception: {
        values: [
          {
            type: error.name || 'Error',
            value: scrubString(error.message || 'Unknown error'),
            stacktrace: error.stack
              ? { frames: this.parseStack(error.stack) }
              : undefined,
          },
        ],
      },
      tags: {
        worker: this.config.workerName || 'unknown',
      },
    };

    if (request) {
      event.request = this.scrubRequest(request);
    }

    if (extra) {
      event.extra = this.scrubExtra(extra);
    }

    return event;
  }

  /**
   * Parse a stack trace string into Sentry-compatible frames.
   */
  private parseStack(stack: string): Array<{ filename?: string; function?: string; lineno?: number; colno?: number }> {
    type Frame = { filename?: string; function?: string; lineno?: number; colno?: number };
    const frames: Frame[] = [];

    const lines = stack.split('\n').slice(1); // Skip first line (error message)
    for (const line of lines) {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        frames.push({
          function: match[1],
          filename: scrubString(match[2]),
          lineno: parseInt(match[3], 10),
          colno: parseInt(match[4], 10),
        });
      } else {
        const simpleMatch = line.match(/at\s+(.+?):(\d+):(\d+)/);
        if (simpleMatch) {
          frames.push({
            filename: scrubString(simpleMatch[1]),
            lineno: parseInt(simpleMatch[2], 10),
            colno: parseInt(simpleMatch[3], 10),
          });
        }
      }
    }

    // Sentry expects frames in reverse order (caller first)
    return frames.reverse();
  }

  /**
   * Extract non-PII request information.
   */
  private scrubRequest(request: Request): SentryWorkerEvent['request'] {
    const url = new URL(request.url);

    return {
      method: request.method,
      // Only pathname, no query params (could contain PII)
      url: `${url.origin}${url.pathname}`,
      headers: {
        'content-type': request.headers.get('content-type') || '',
        'user-agent': request.headers.get('user-agent') || '',
      },
    };
  }

  /**
   * Scrub extra context data.
   */
  private scrubExtra(extra: Record<string, unknown>): Record<string, unknown> {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(extra)) {
      if (typeof value === 'string') {
        scrubbed[key] = scrubString(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        scrubbed[key] = value;
      } else {
        scrubbed[key] = '[COMPLEX_TYPE]';
      }
    }
    return scrubbed;
  }

  /**
   * Send an event to Sentry via HTTP POST.
   * Uses waitUntil pattern for Workers (caller should manage execution context).
   */
  private async send(event: SentryWorkerEvent): Promise<void> {
    if (!this.parsedDsn) return;

    const url = getSentryIngestUrl(this.parsedDsn);

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } catch {
      // Sentry delivery failure is non-fatal for workers
    }
  }
}

/**
 * Create a Sentry middleware wrapper for Cloudflare Workers fetch handler.
 *
 * Catches unhandled exceptions in the fetch handler and reports them to Sentry
 * before returning a 500 response.
 *
 * @example
 * ```ts
 * export default {
 *   fetch: withSentry(
 *     { dsn: 'https://...', workerName: 'buildit-api' },
 *     async (request, env) => {
 *       // Your handler logic
 *       return new Response('OK');
 *     }
 *   ),
 * };
 * ```
 */
export function withSentry<E extends Record<string, unknown>>(
  config: WorkerSentryConfig,
  handler: (request: Request, env: E, ctx: ExecutionContext) => Promise<Response>,
): (request: Request, env: E, ctx: ExecutionContext) => Promise<Response> {
  return async (request: Request, env: E, ctx: ExecutionContext): Promise<Response> => {
    const sentry = new WorkerSentry({
      ...config,
      dsn: config.dsn || (env.SENTRY_DSN as string | undefined),
      environment: config.environment || (env.ENVIRONMENT as string | undefined) || 'production',
    });

    try {
      return await handler(request, env, ctx);
    } catch (error) {
      // Report to Sentry in the background (don't block the response)
      ctx.waitUntil(sentry.captureException(error, request));

      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  };
}
