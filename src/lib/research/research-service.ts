import { getOpenAI } from '../openai-client';
import { getConfig } from '../config/index';
import { buildContext } from '../config/context';
import type { IntakeFormData } from '../types';

/**
 * Runs pre-interview research using OpenAI with web search.
 * Prompt and system instructions come from config.research.
 */
export async function runDestinationResearch(intake: IntakeFormData): Promise<unknown> {
  const cfg = getConfig();
  if (!cfg.research?.enabled) return null;

  // Build a minimal context from the intake form data.
  // Research runs before the session's IntakeResponse row is fully hydrated,
  // so we construct context from the raw form body.
  const ctx = buildContext(
    intake as unknown as import('../types').IntakeResponse,
    null,
  );

  const prompt = cfg.research.promptBuilder(ctx);
  const systemInstructions =
    cfg.research.systemInstructions ??
    'You are a research assistant. Always search the web for real, current information about the topic.';

  const response = await getOpenAI().responses.create({
    model: 'gpt-4.1',
    instructions: systemInstructions,
    input: prompt,
    tools: [{ type: 'web_search_preview' }],
  });

  // Extract text output from the Responses API format.
  let rawText = '';
  for (const item of response.output) {
    if (item.type === 'message' && item.content) {
      for (const block of item.content) {
        if (block.type === 'output_text') rawText += block.text;
      }
    }
  }

  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}
