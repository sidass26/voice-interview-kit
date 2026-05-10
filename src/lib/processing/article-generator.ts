import { getOpenAI } from '../openai-client';
import { buildArticlePrompt } from '../prompts/article';
import type { ExtractedData, IntakeResponse } from '../types';

/**
 * Generates a first-person travel article from extracted data and transcript.
 */
export async function generateArticle(
  extracted: ExtractedData,
  cleanedTranscript: string,
  intake: IntakeResponse
): Promise<string> {
  const prompt = buildArticlePrompt(extracted, cleanedTranscript, intake);

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 4000,
  });

  return response.choices[0]?.message?.content || '';
}
