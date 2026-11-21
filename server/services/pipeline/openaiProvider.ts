/**
 * P4-E — shared OpenAI Structured Outputs adapter.
 *
 * Builds a `StructuredGenerate` function that P4-A and P4-C receive by injection. Constructing
 * the adapter performs no network call; the OpenAI client is created lazily on the first call.
 *
 * Failure behavior (always a sanitized PipelineError, never the key or a raw upstream body):
 * - missing apiKey/model, authentication or permission failure -> CONFIGURATION
 * - caller abort -> ABORTED; request exceeding `timeoutMs` (default 20000) -> TIMEOUT
 * - other API/HTTP/network failures -> PROVIDER
 * - refusal, incomplete/failed response, empty or non-JSON output, rejected validation -> INVALID_OUTPUT
 * No retry loop: SDK retries are disabled (maxRetries 0) so one call stays within `timeoutMs`.
 */
import OpenAI from 'openai'
import {
  PipelineError,
  type OpenAIProviderOptions,
  type StructuredGenerate,
  type StructuredRequest,
} from './contracts.ts'

const DEFAULT_TIMEOUT_MS = 20000
const SCHEMA_NAME = /^[a-zA-Z0-9_-]{1,64}$/

export function createOpenAIStructuredGenerator(options: OpenAIProviderOptions): StructuredGenerate {
  const apiKey = options.apiKey?.trim() ?? ''
  const model = options.model?.trim() ?? ''
  const timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS
  let client: OpenAI | undefined

  return async function generate<T>(request: StructuredRequest<T>, signal?: AbortSignal): Promise<T> {
    if (!apiKey) throw new PipelineError('CONFIGURATION', 'OpenAI API key is not configured.')
    if (!model) throw new PipelineError('CONFIGURATION', 'OpenAI analysis model is not configured.')
    if (!SCHEMA_NAME.test(request.name)) {
      throw new PipelineError('CONFIGURATION', 'Structured output schema name is invalid.')
    }
    if (signal?.aborted) throw new PipelineError('ABORTED', 'Structured generation was aborted.')

    client ??= new OpenAI({ apiKey, maxRetries: 0, timeout: timeoutMs })

    let response: OpenAI.Responses.Response
    try {
      response = await client.responses.create({
        model,
        instructions: request.instructions,
        input: request.input,
        store: false,
        text: {
          format: { type: 'json_schema', name: request.name, schema: request.schema, strict: true },
        },
      }, { signal, timeout: timeoutMs })
    } catch (error) {
      throw toPipelineError(error, signal)
    }

    if (response.status && response.status !== 'completed') {
      const reason = response.incomplete_details?.reason
      throw new PipelineError('INVALID_OUTPUT', `Structured generation did not complete (${response.status}${reason ? `: ${reason}` : ''}).`)
    }
    if (hasRefusal(response)) throw new PipelineError('INVALID_OUTPUT', 'The model refused the structured generation request.')

    const text = response.output_text?.trim()
    if (!text) throw new PipelineError('INVALID_OUTPUT', 'Structured generation returned empty output.')

    let value: unknown
    try {
      value = JSON.parse(text)
    } catch {
      throw new PipelineError('INVALID_OUTPUT', 'Structured generation returned invalid JSON.')
    }

    try {
      return request.validate(value)
    } catch (error) {
      if (error instanceof PipelineError) throw error
      throw new PipelineError('INVALID_OUTPUT', 'Structured generation output failed validation.')
    }
  }
}

function hasRefusal(response: OpenAI.Responses.Response): boolean {
  return response.output.some(item => item.type === 'message' && item.content.some(part => part.type === 'refusal'))
}

function toPipelineError(error: unknown, signal?: AbortSignal): PipelineError {
  if (error instanceof PipelineError) return error
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new PipelineError('TIMEOUT', 'Structured generation timed out.')
  }
  if (error instanceof OpenAI.APIUserAbortError || signal?.aborted) {
    return new PipelineError('ABORTED', 'Structured generation was aborted.')
  }
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
    return new PipelineError('CONFIGURATION', 'OpenAI rejected the configured credentials.')
  }
  if (error instanceof OpenAI.NotFoundError) {
    return new PipelineError('CONFIGURATION', 'OpenAI could not find the configured model.')
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new PipelineError('PROVIDER', 'Could not reach the OpenAI API.')
  }
  if (error instanceof OpenAI.APIError) {
    return new PipelineError('PROVIDER', `OpenAI request failed${error.status ? ` with status ${error.status}` : ''}.`)
  }
  return new PipelineError('PROVIDER', 'Structured generation failed unexpectedly.')
}
