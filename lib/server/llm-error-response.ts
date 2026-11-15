import { APICallError, RetryError } from 'ai';
import { modelAuthorizationResponse, apiError } from '@/lib/server/api-response';

const HTTP_ERROR_MIN = 400;
const HTTP_ERROR_MAX = 599;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toHttpErrorStatus(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isInteger(parsed) && parsed >= HTTP_ERROR_MIN && parsed <= HTTP_ERROR_MAX
    ? parsed
    : undefined;
}

/** The provider's HTTP error status carried by an AI SDK (or similar) error, if any. */
export function upstreamHttpStatus(error: unknown): number | undefined {
  return statusFromError(error);
}

/**
 * Google can report an invalid API key as HTTP 400 with API_KEY_INVALID rather
 * than the 401/403 used by most providers. Inspect only for classification;
 * provider response bodies are never returned to the client.
 */
export function isInvalidProviderCredentialsError(
  error: unknown,
  seen = new Set<unknown>(),
): boolean {
  if (!error || seen.has(error)) return false;
  seen.add(error);

  if (APICallError.isInstance(error)) {
    const body = error.responseBody ?? '';
    if (
      /\bAPI_KEY_INVALID\b|api key (?:is )?not valid|invalid api key|api key (?:is )?(?:invalid|expired|rejected)/i.test(
        body,
      )
    ) {
      return true;
    }
  }

  if (RetryError.isInstance(error)) {
    return (
      isInvalidProviderCredentialsError(error.lastError, seen) ||
      error.errors.some((nested) => isInvalidProviderCredentialsError(nested, seen))
    );
  }

  if (isRecord(error)) {
    return (
      isInvalidProviderCredentialsError(error.cause, seen) ||
      isInvalidProviderCredentialsError(error.lastError, seen)
    );
  }

  return false;
}

function isMissingProviderApiKeyError(error: unknown): boolean {
  return error instanceof Error && /API key required for provider:/i.test(error.message);
}

function statusFromError(error: unknown, seen = new Set<unknown>()): number | undefined {
  if (!error || seen.has(error)) return undefined;
  seen.add(error);

  if (APICallError.isInstance(error)) {
    return toHttpErrorStatus(error.statusCode);
  }

  if (RetryError.isInstance(error)) {
    return (
      statusFromError(error.lastError, seen) ??
      error.errors
        .map((nested) => statusFromError(nested, seen))
        .find((status): status is number => status !== undefined)
    );
  }

  if (!isRecord(error)) return undefined;

  const status = toHttpErrorStatus(error.statusCode ?? error.status ?? error.status_code);
  if (status !== undefined) return status;

  return statusFromError(error.cause, seen) ?? statusFromError(error.lastError, seen);
}

function messageForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return 'Upstream authentication or authorization failed.';
  }
  if (status === 404) return 'Upstream endpoint not found.';
  if (status === 429) return 'Upstream rate limit reached. Please try again shortly.';
  if (status >= 500) return 'Upstream model provider is temporarily unavailable. Please try again.';
  return 'Upstream provider rejected the request.';
}

/**
 * Preserve a provider's HTTP semantics for client retry classification without
 * exposing provider response bodies, URLs, or credential-adjacent details.
 */
export function llmApiError(error: unknown) {
  const refusal = modelAuthorizationResponse(error);
  if (refusal) return refusal;

  if (isMissingProviderApiKeyError(error)) {
    return apiError('MISSING_API_KEY', 401, 'API key is not configured for the selected provider.');
  }

  if (isInvalidProviderCredentialsError(error)) {
    return apiError(
      'INVALID_CREDENTIALS',
      401,
      'The model provider rejected its API key. Check the provider credentials.',
    );
  }

  const status = statusFromError(error);
  if (status === undefined) {
    return apiError('INTERNAL_ERROR', 500, 'Scene generation failed. Please try again.');
  }

  return apiError(
    status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR',
    status,
    messageForStatus(status),
  );
}
