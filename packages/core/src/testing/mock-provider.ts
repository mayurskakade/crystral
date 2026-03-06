/**
 * Mock provider that returns fixed responses without calling any real LLM API.
 */
import type { CompletionOptions, CompletionResult } from '../types/runtime.js';

export class MockProvider {
  /**
   * Return an echo of the last user message (or 'mock response' if none).
   * If the last message content looks like JSON, returns it as-is so that
   * structured-output tests can work.
   */
  complete(
    messages: Array<{ role: string; content: string }>,
    _options?: CompletionOptions,
  ): Promise<CompletionResult> {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content ?? 'mock response';

    return Promise.resolve({
      content,
      finish_reason: 'stop' as const,
      input_tokens: 0,
      output_tokens: 0,
    });
  }
}
