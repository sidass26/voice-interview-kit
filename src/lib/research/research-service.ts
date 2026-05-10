import { getOpenAI } from '../openai-client';
import { buildResearchPrompt } from '../prompts/research';
import type { DestinationResearch } from '../types';

/**
 * Runs destination research using OpenAI with web search capabilities.
 * Searches Reddit and travel forums for real traveler discussions.
 */
export async function runDestinationResearch(
  destination: string,
  cities: string[],
  tripType: string,
  purpose: string
): Promise<DestinationResearch> {
  const prompt = buildResearchPrompt(destination, cities, tripType, purpose);

  const response = await getOpenAI().responses.create({
    model: 'gpt-4.1',
    instructions: 'You are a travel research assistant. Always search the web for real, current information. Focus especially on Reddit discussions for authentic traveler opinions.',
    input: prompt,
    tools: [{ type: 'web_search_preview' }],
  });

  // Extract the text output from the response
  let rawText = '';
  for (const item of response.output) {
    if (item.type === 'message' && item.content) {
      for (const block of item.content) {
        if (block.type === 'output_text') {
          rawText += block.text;
        }
      }
    }
  }

  // Parse the JSON response
  const cleanedText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const research: DestinationResearch = JSON.parse(cleanedText);

  return research;
}
