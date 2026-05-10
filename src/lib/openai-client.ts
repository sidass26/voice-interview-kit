import OpenAI from 'openai';

/**
 * Lazy-initialized OpenAI client.
 * Avoids crashing during Next.js build when env vars aren't available.
 */
let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_client) {
    _client = new OpenAI();
  }
  return _client;
}
