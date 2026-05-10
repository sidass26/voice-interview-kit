import type { TopicBuckets, TopicBucketKey } from '../types';

/**
 * Creates a fresh topic tracker state.
 * This is embedded in the system prompt, not used as runtime middleware.
 */
export function createInitialTopicState(): TopicBuckets {
  const buckets: Partial<TopicBuckets> = {};
  const keys: readonly TopicBucketKey[] = [
    'trip_overview',
    'highlights',
    'disappointments',
    'food',
    'restaurants',
    'logistics',
    'budget',
    'mistakes',
    'who_its_for',
    'practical_tips',
    'closing',
  ];

  for (const key of keys) {
    buckets[key] = { covered: false, depth: 'none' };
  }

  return buckets as TopicBuckets;
}

/**
 * Builds the topic tracking instructions for the system prompt.
 * When an itinerary is available, the day-by-day flow is the primary structure
 * and these topic buckets serve as cross-cutting checks.
 */
export function buildTopicTrackingInstructions(): string {
  return `
## TOPIC PROGRESSION RULES

You must internally track which topics you've covered. Use this as your internal checklist:

### PER-DAY COVERAGE (if itinerary is available)
For each day/city block in the itinerary, track whether you've asked about:
- What they did / saw
- Food or dining that day
- Anything memorable (good or bad)

### CROSS-CUTTING TOPICS (must all be covered before closing)
□ food — Specific dishes, food culture, food experiences
□ restaurants — At least ONE specific restaurant/cafe with details
□ budget — How much it cost, value for money
□ disappointments — At least one honest negative
□ mistakes — What they'd do differently
□ practical_tips — Concrete advice for future travelers
□ who_its_for — Who they'd recommend this trip to

### PROGRESSION RULES
1. If you have an itinerary, walk through it day-by-day first. This is more natural than topic hopping.
2. Within each day, naturally cover highlights, food, and any issues.
3. After the day walk-through, check your cross-cutting list. Ask about anything still missing.
4. Maximum 3 questions per topic. If you have good material, move on.
5. If they naturally mention something from another bucket during day talk, COUNT IT — don't re-ask.
6. MANDATORY before closing: food, restaurants, budget, and at least one honest negative.
7. When transitioning between topics, use natural bridges.
8. The closing should happen AFTER all mandatory topics are covered.
9. Keep the whole interview to roughly 15-20 minutes. Don't drag it out.

### ANTI-REPETITION CHECKLIST
Before asking any question, check:
- Have I already asked about this specific thing? → SKIP
- Is this a rewording of a previous question? → SKIP
- Have I gotten enough on this topic? → MOVE ON
- Am I asking generic filler questions? → BE MORE SPECIFIC
`;
}
