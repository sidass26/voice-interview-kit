import { getOpenAI } from '../openai-client';
import { buildExtractionPrompt } from '../prompts/extraction';
import type { ExtractedData } from '../types';

/**
 * Extracts structured data from a cleaned transcript.
 */
export async function extractStructuredData(
  cleanedTranscript: string,
  destination: string,
  cities: string[]
): Promise<ExtractedData> {
  const prompt = buildExtractionPrompt(cleanedTranscript, destination, cities);

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const rawText = response.choices[0]?.message?.content || '{}';
  return JSON.parse(rawText) as ExtractedData;
}
