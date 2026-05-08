import { describe, expect, it } from 'vitest'
import {
  formatCursorLlmError,
  normalizeCursorLlmBaseUrl,
} from '../cursorLlmUtils'
import { isChatCompletionsProvider } from '../providerCatalog'

describe('cursorLlmUtils', () => {
  it('normalizes and requires /v1 suffix', () => {
    expect(normalizeCursorLlmBaseUrl('https://example.com/api/v1')).toBe(
      'https://example.com/api/v1'
    )
    expect(normalizeCursorLlmBaseUrl('https://example.com/api/v1/')).toBe(
      'https://example.com/api/v1'
    )
    expect(() => normalizeCursorLlmBaseUrl('https://example.com/api')).toThrow(
      /must end with \/v1/
    )
  })

  it('formats HTTP status codes clearly', () => {
    expect(
      formatCursorLlmError({ status: 401, message: 'bad' }, 'chat.completions')
    ).toContain('Unauthorized')
    expect(
      formatCursorLlmError({ status: 404, message: 'nope' }, 'models.list')
    ).toContain('GET /v1/models')
    expect(
      formatCursorLlmError({ status: 429, message: 'slow down' }, 'models.list')
    ).toContain('Rate limited')
  })
})

describe('providerCatalog cursor', () => {
  it('treats cursor as a chat-completions-backed provider', () => {
    expect(isChatCompletionsProvider('cursor')).toBe(true)
  })
})
