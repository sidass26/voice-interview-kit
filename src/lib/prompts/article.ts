import type { ExtractedData, IntakeResponse } from '../types';

/**
 * Article generation prompt — creates a first-person travel article from extracted data + transcript.
 * CRITICAL: Never fabricate details not in the source material.
 */
export function buildArticlePrompt(
  extracted: ExtractedData,
  cleanedTranscript: string,
  intake: IntakeResponse
): string {
  return `Write a first-person travel article based on a real interview with someone who visited ${extracted.destination}. This should read like authentic travel content — personal, practical, and honest.

## SOURCE MATERIAL
### Extracted Data
${JSON.stringify(extracted, null, 2)}

### Full Interview Transcript
${cleanedTranscript}

### Intake Info
- Author: ${intake.employee_name}
- Trip: ${intake.trip_type}
- Purpose: ${intake.trip_purpose}
- Duration: ${intake.trip_duration_days || 'not specified'} days

## ARTICLE STRUCTURE
Use these sections. SKIP any section that has no real content from the interview — an honest gap is better than fabrication.

### Title
Create a specific, non-generic title. Include the destination and a hint of the angle.
Bad: "My Trip to Japan" / "Everything You Need to Know About Tokyo"
Good: "5 Days in Tokyo: What We Actually Spent, Ate, and Wish We'd Known"

### 1. Intro — Who went where and why
- Set the scene: who traveled, when, why
- Keep it brief — 2-3 sentences

### 2. What stood out most
- The genuine highlights, in their voice
- Specific moments, not generic praise

### 3. What we genuinely loved
- Deeper detail on the best parts
- Use specific names, places, experiences

### 4. What disappointed us / what wasn't worth it
- Honest negatives — this is what makes the article trustworthy
- Don't sugarcoat
- If no negatives were mentioned, write a brief note like "Honestly, nothing major disappointed us" rather than inventing complaints

### 5. Food and restaurant highlights
- ONLY include dishes and restaurants that were actually mentioned in the interview
- If they named specific restaurants, include them with their actual descriptions
- If they didn't name specific restaurants, DO NOT invent any — write something like "We ate well throughout the trip" and focus on general food observations
- Never fabricate dish names, restaurant names, or food experiences

### 6. What planning the trip was actually like
- Logistics, transport, accommodation — only what they discussed
- What was easy, what was hard

### 7. What it cost us
- ONLY include budget details that were actually stated
- If budget was not discussed, either SKIP this section entirely or write: "We didn't track exact numbers, but [include any general impressions about cost they shared]"
- NEVER invent or estimate budget figures
- If they gave partial numbers (e.g., flights but not hotels), only include what they said

### 8. Who we'd recommend this trip to
- Be specific: "perfect for couples who like X" not just "great for everyone"
- Only include if they actually discussed this

### 9. Practical tips / things to know
- Concrete, actionable advice they actually gave
- The stuff you only learn by going

## WRITING RULES
- First person: "I" or "we" depending on who traveled
- Conversational but not sloppy
- Use the interviewee's actual words and phrases where they were vivid or specific
- Include specific details: names of places, dishes, prices, neighborhoods — ONLY those actually mentioned
- Keep honest negatives — they make the piece credible
- NO generic travel writing ("a feast for the senses", "hidden gem", "off the beaten path")
- NO AI-sounding phrases ("embark on a journey", "a tapestry of", "nestled in")
- Length: 1200-2000 words
- Format as markdown with clear section headers

## USING THE EVIDENCE LOG
The extracted data includes an "_evidenceLog" field that maps each extracted fact to a direct transcript quote. Use this as your source of truth:
- If a fact has an evidence entry, you can use it in the article
- If a fact does NOT have an evidence entry, treat it with extreme skepticism — verify it against the transcript yourself
- The evidence log is your safeguard against hallucinated extractions

## CRITICAL ANTI-FABRICATION RULES
1. EVERY specific claim (dish name, restaurant name, price, place name, activity) MUST come from the transcript or extracted data with evidence
2. If a section has no real data, either skip it or write an honest acknowledgment ("We didn't keep close track of costs")
3. Do not "fill in" missing details with plausible-sounding content
4. Do not add atmospheric descriptions that weren't in the interview
5. The interviewee's voice and their actual observations are the article — do not supplement with your own knowledge
6. If the extracted data shows null for budget, DO NOT write budget numbers
7. If restaurantMentions is empty, DO NOT name any restaurants

## OUTPUT
Return the full article in markdown format. Start with the title as an H1.`;
}
