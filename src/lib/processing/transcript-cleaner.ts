import { getOpenAI } from '../openai-client';
import { buildTranscriptCleanupPrompt } from '../prompts/transcript-cleanup';
import type { TranscriptEntry } from '../types';

/**
 * Converts raw transcript entries into a readable string, then cleans it up with AI.
 */
export async function cleanTranscript(entries: TranscriptEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  // Build raw transcript string from entries
  const rawTranscript = entries
    .map((e) => {
      const speaker = e.role === 'interviewer' ? 'Interviewer' : 'Interviewee';
      return `${speaker}: ${e.text}`;
    })
    .join('\n\n');

  const prompt = buildTranscriptCleanupPrompt(rawTranscript);

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || rawTranscript;
}
