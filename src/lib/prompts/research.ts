/**
 * Research prompt — generates destination-specific interview sharpening hints.
 * Uses OpenAI with web search to pull in Reddit discussions and real traveler opinions.
 */
export function buildResearchPrompt(
  destination: string,
  cities: string[],
  tripType: string,
  purpose: string
): string {
  const cityList = cities.join(', ');

  return `You are a travel research assistant preparing briefing notes for an interviewer. The interviewer will be talking to someone who just visited ${destination} (specifically: ${cityList}). Their trip was: ${tripType}, purpose: ${purpose}.

Your job: produce structured research notes that will help the interviewer ask SHARP, SPECIFIC questions instead of generic ones.

## RESEARCH APPROACH
Search the web, especially Reddit (r/travel, r/solotravel, r/foodtravel, destination-specific subreddits), for real traveler discussions about ${destination}. Look for:
- "What do people wish they knew before visiting ${destination}?"
- "Best food in ${cityList}" discussions
- "Is ${destination} worth it?" debates
- "${destination} budget breakdown" threads
- "Mistakes I made in ${destination}" posts
- "${cityList} itinerary" advice threads
- Overrated vs underrated takes on ${destination}

## OUTPUT FORMAT
Return a JSON object with this exact structure:

{
  "destination": "${destination} — ${cityList}",
  "summary": "2-3 sentence overview of what makes this destination interesting to interview about",
  "bucketHints": {
    "trip_overview": {
      "hints": ["Known itinerary debates or decisions travelers face", "Regional differences worth asking about"]
    },
    "highlights": {
      "hints": ["Top-rated experiences according to real travelers", "Things that consistently surprise people positively"]
    },
    "disappointments": {
      "hints": ["Common complaints from real travelers", "Things frequently called overrated"]
    },
    "food": {
      "hints": ["Must-try local dishes with specific names", "Food culture angles (street food vs restaurants, dietary considerations)", "Dishes that travelers specifically recommend"]
    },
    "restaurants": {
      "hints": ["Specific restaurants/cafes that come up in traveler discussions", "Types of dining experiences unique to this destination"]
    },
    "logistics": {
      "hints": ["Transport debates (which option is best)", "Accommodation area recommendations", "Getting around challenges"]
    },
    "budget": {
      "hints": ["Typical daily budget ranges for different travel styles", "Common unexpected costs", "Money-saving tips that real travelers share"]
    },
    "mistakes": {
      "hints": ["Most common tourist mistakes", "Things people wish they'd known", "Scams or tourist traps to be aware of"]
    },
    "practical_tips": {
      "hints": ["SIM/connectivity advice", "Visa/entry specifics", "Cultural norms visitors should know", "Best time to visit specific attractions"]
    }
  },
  "uniqueAngles": ["Destination-specific debate or angle the interviewer should try to explore"],
  "redditQuestions": ["Actual questions people ask about this destination on Reddit — the interview should help answer these"],
  "cityResearch": {
${cities.map((c) => `    "${c}": {
      "food": ["Must-try dishes and food experiences specific to ${c}"],
      "activities": ["Top things to do in ${c} according to real travelers"],
      "tips": ["Practical tips specific to ${c}"],
      "commonMistakes": ["Common mistakes tourists make in ${c}"]
    }`).join(',\n')}
  }
}

## RULES
- Be SPECIFIC. Include actual dish names, restaurant names, neighborhood names, price ranges.
- Each hint should be actionable for the interviewer — it should help them ask a better question.
- Include 2-4 hints per bucket. Quality over quantity.
- The cityResearch section is IMPORTANT — give city-specific food, activity, and tip hints for each city visited.
- The redditQuestions should be real questions travelers ask, not made up ones.
- If you find genuine Reddit threads, synthesize the discussions. Don't just list URLs.
- Focus on information that will help create genuinely useful travel content.

Return ONLY the JSON object, no markdown wrapping.`;
}
