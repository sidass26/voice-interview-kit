import { getOpenAI } from '../openai-client';
import { getConfig } from '../config/index';
import type { InterviewContext } from '../config/types';

/**
 * Generates the primary output artifact (e.g. a travel article) from
 * extracted data and the cleaned transcript.
 *
 * Uses config.outputs[0] — the first (primary) output definition.
 * Model and prompt both come from config, making this function domain-agnostic.
 */
export async function generateArticle(
  extracted: Record<string, unknown>,
  cleanedTranscript: string,
  ctx: InterviewContext,
): Promise<string> {
  const cfg = getConfig();
  const output = cfg.outputs[0];

  const prompt = output.promptBuilder(extracted, cleanedTranscript, ctx);
  const model  = output.model ?? 'gpt-4.1';

  const response = await getOpenAI().chat.completions.create({
    model,
    messages:   [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens:  4000,
  });

  return response.choices[0]?.message?.content ?? '';
}
