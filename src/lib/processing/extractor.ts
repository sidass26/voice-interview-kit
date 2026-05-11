import { getOpenAI } from '../openai-client';
import { getConfig } from '../config/index';
import type { InterviewContext } from '../config/types';

/**
 * Extracts structured facts from a cleaned transcript.
 * Prompt is built by config.extraction.promptBuilder.
 */
export async function extractStructuredData(
  cleanedTranscript: string,
  ctx: InterviewContext,
): Promise<Record<string, unknown>> {
  const cfg = getConfig();
  const prompt = cfg.extraction.promptBuilder(cleanedTranscript, ctx);

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const rawText = response.choices[0]?.message?.content ?? '{}';
  return JSON.parse(rawText) as Record<string, unknown>;
}
