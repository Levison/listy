/**
 * Helpers for the OpenAI-compatible Cursor LLM gateway (user-provided base URL + API key).
 */

export function normalizeCursorLlmBaseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Cursor LLM base URL is empty.')
  }
  const noTrailing = trimmed.replace(/\/+$/, '')
  if (!/\/v1$/i.test(noTrailing)) {
    throw new Error(
      'Cursor LLM base URL must end with /v1 (OpenAI-compatible API root). Example: https://your-host/v1'
    )
  }
  return noTrailing
}

export function formatCursorLlmError(
  err: unknown,
  context: 'models.list' | 'chat.completions'
): string {
  const base = `Cursor LLM (${context})`
  const e = err as {
    status?: number
    message?: string
    error?: { message?: string }
    code?: string
    cause?: unknown
  }

  const status = e?.status
  const apiMsg =
    e?.error?.message ||
    (typeof e?.message === 'string' ? e.message : '') ||
    String(err)

  if (
    apiMsg.includes('Failed to fetch') ||
    apiMsg.includes('NetworkError') ||
    apiMsg.includes('Load failed') ||
    (typeof err === 'object' &&
      err !== null &&
      String((err as Error).name) === 'TypeError')
  ) {
    return `${base}: Network error — the gateway may be unreachable, blocked, or rejecting browser requests (CORS). Use a gateway that allows requests from this app, or proxy LLM calls through your backend. Original: ${apiMsg}`
  }

  if (status === 401 || status === 403) {
    return `${base}: Unauthorized (${status}) — invalid API key or insufficient permissions for this gateway. ${apiMsg}`
  }

  if (status === 404) {
    if (context === 'models.list') {
      return `${base}: Not found (404) — this base URL does not expose GET /v1/models. Enter a model ID manually in Assistant settings, or fix the base URL. ${apiMsg}`
    }
    return `${base}: Not found (404) — wrong base URL or path; expected OpenAI-compatible routes under …/v1 (e.g. …/v1/chat/completions). ${apiMsg}`
  }

  if (status === 429) {
    return `${base}: Rate limited (429) — quota exceeded or too many requests. Check your Cursor or gateway plan and limits. ${apiMsg}`
  }

  if (status != null && status >= 400) {
    return `${base}: Request failed (${status}). ${apiMsg}`
  }

  return `${base}: ${apiMsg}`
}
