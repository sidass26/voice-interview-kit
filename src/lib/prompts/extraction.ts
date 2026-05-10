/**
 * Structured extraction prompt — pulls structured data from the interview transcript.
 * Uses a TWO-PASS approach: first identify quotes, then extract structured data from quotes only.
 */
export function buildExtractionPrompt(
  cleanedTranscript: string,
  destination: string,
  cities: string[]
): string {
  return `You are extracting structured data from a travel interview transcript. The interviewee visited ${destination} (${cities.join(', ')}).

## TRANSCRIPT
${cleanedTranscript}

## YOUR TASK — TWO PASSES

### PASS 1: FIND DIRECT QUOTES
First, mentally scan the transcript and identify ONLY the interviewee's direct statements. Ignore the interviewer's questions. For each piece of information, you must be able to point to where the interviewee said it.

### PASS 2: EXTRACT FROM QUOTES ONLY
Using ONLY what the interviewee explicitly stated, fill the JSON structure below.

## EXTRACTION RULES — THESE ARE ABSOLUTE

**THE GOLDEN RULE: If the interviewee did not say it, it does not exist.**

### CRITICAL: INTERVIEWER QUESTIONS ARE NOT FACTS
The interviewer may mention specific places, dishes, or activities in their QUESTIONS (e.g. "Did you try the shuwa?" or "What about the Mutrah Souq?"). These are NOT facts about the trip. You MUST only extract information from the INTERVIEWEE's responses.

Examples of what to IGNORE:
- Interviewer asks: "Did you try the local ramen?" → Interviewee says: "No, we didn't get a chance" → Do NOT extract "ramen" as a food mention
- Interviewer asks: "Did you visit the Grand Bazaar?" → Interviewee says: "Yeah it was nice" → Extract "Grand Bazaar" as visited (the interviewee CONFIRMED it)
- Interviewer asks: "Did you try the shuwa?" → Interviewee says: "What's that?" → Do NOT extract "shuwa" — the interviewee didn't know what it was
- Interviewer asks: "How was the street food scene?" → Interviewee says: "Amazing, we had these great kebabs from a cart" → Extract "kebabs from a street cart" (interviewee's words), NOT "street food scene" (interviewer's framing)

**The rule: Only the INTERVIEWEE's own words count. The interviewer's questions are prompts, not data.**

### Other failure modes to AVOID:
- Interviewee says "we checked into the hotel" → Do NOT extract "hotel buffet" or "hotel breakfast" — they didn't say they ATE anything
- Interviewee says "we walked around the city" → Do NOT extract specific neighborhoods or landmarks unless they NAMED them
- Interviewee says "the food was good" → Do NOT extract specific dish names — they didn't NAME any dishes
- Interviewee says "it was affordable" → Do NOT extract "$50 per day" — they didn't give a NUMBER
- Interviewee mentions a city → Do NOT invent activities they did there unless they DESCRIBED those activities

**For each extracted item, ask yourself: "Can I quote the exact words from the transcript that support this?" If NO → leave it out.**

## OUTPUT FORMAT
Return a JSON object with this structure. Use null for missing string values and [] for missing arrays.

{
  "destination": "${destination}",
  "cities": ${JSON.stringify(cities)},
  "tripDuration": null,
  "travelMonth": null,
  "travelParty": null,
  "numTravelers": null,
  "purpose": null,
  "authorName": null,
  "highlights": [],
  "disappointments": [],
  "foodMentions": [],
  "restaurantMentions": [],
  "budgetBreakdown": {
    "total": null,
    "flights": null,
    "hotels": null,
    "food": null,
    "experiences": null
  },
  "mistakes": [],
  "tips": [],
  "whoItsFor": null,
  "bestTimeToVisit": null,
  "overallVerdict": null,
  "dayByDay": [],
  "suggestedArticles": [],
  "_evidenceLog": []
}

### Field descriptions:
- highlights: Things the interviewee explicitly said they loved or enjoyed. Use their words.
- disappointments: Things they explicitly said were bad, disappointing, or not worth it.
- foodMentions: ONLY specific food items they NAMED. "The food was good" is NOT a food mention. "We had amazing ramen" IS.
- restaurantMentions: ONLY restaurants/cafes they mentioned BY NAME. Each needs: name, location (if stated), whatTheyHad (if stated), verdict (if stated). Leave sub-fields null if not stated.
- budgetBreakdown: ONLY explicit numbers they stated. "It was expensive" is NOT a budget figure. "Flights were 800 dollars" IS.
- dayByDay: Only days where they provided specific content. Do NOT create entries for days they didn't discuss.
- suggestedArticles: 2-5 article ideas based on content density. Only suggest what has enough material.

### _evidenceLog (REQUIRED):
For each non-trivial extraction, include the supporting quote. Format:
[
  {"field": "highlights[0]", "quote": "the sunrise at Jebel Shams was incredible"},
  {"field": "foodMentions[0]", "quote": "we had this amazing shuwa, it's like slow-roasted lamb"},
  {"field": "budgetBreakdown.flights", "quote": "flights cost us about 350 each"}
]

This log is used for verification. If you cannot write an evidence entry for a data point, DO NOT include that data point.

## BUDGET RULES
- null means "not mentioned" — this is correct and expected
- NEVER estimate. NEVER approximate. NEVER infer from context.
- Only extract the exact figures or phrases the interviewee used.

Return ONLY the JSON object.`;
}
