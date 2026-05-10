/**
 * Transcript cleanup prompt — turns raw voice transcript into clean, readable text.
 */
export function buildTranscriptCleanupPrompt(rawTranscript: string): string {
  return `Clean up this raw voice interview transcript. The interview is between a travel interviewer and an employee about their vacation.

## RULES
- Fix obvious speech-to-text errors
- Remove filler words (um, uh, like, you know) ONLY when they add nothing — keep them if they convey hesitation or emphasis
- Fix punctuation and sentence boundaries
- Keep the conversational tone — do NOT make it sound formal or written
- Preserve the speaker's actual words and meaning — do not rephrase or summarize
- Label speakers as "Interviewer:" and "Interviewee:"
- Keep all specific details (names, places, prices, dishes) exactly as spoken
- If something is unclear, keep it and mark with [unclear]

## RAW TRANSCRIPT
${rawTranscript}

## OUTPUT
Return the cleaned transcript with clear speaker labels. Preserve the full conversation.`;
}
