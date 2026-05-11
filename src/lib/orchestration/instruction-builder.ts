import type { IntakeResponse, DestinationResearch } from '../types';
import {
  buildIntakeContext,
  buildResearchContext,
  buildItineraryContext,
} from '../prompts/interviewer';
import { buildTopicTrackingInstructions } from './topic-tracker';
import { getConfig } from '../config/index';
import { buildContext } from '../config/context';

/**
 * Builds the complete system instructions for the Realtime API session.
 *
 * Section order:
 *   1. Persona        — from config.interview.personaBuilder (domain-specific voice + motivation)
 *   2. Intake context — who is being interviewed and what we already know
 *   3. Itinerary flow — day-by-day guide for the interview (travel-specific, Phase C will generalize)
 *   4. Research hints — community-sourced questions baked in pre-interview
 *   5. Topic tracker  — coverage rules enforced by the engine
 */
export function buildInterviewInstructions(
  intake: IntakeResponse,
  research: DestinationResearch | null,
): string {
  const cfg = getConfig();
  const ctx = buildContext(intake, research);

  const sections: string[] = [
    cfg.interview.personaBuilder(ctx),
    buildIntakeContext(intake),
    buildItineraryContext(intake.itinerary || []),
  ];

  sections.push(
    research
      ? buildResearchContext(research)
      : `## RESEARCH NOTE\nBackground research is not yet available. Use your general knowledge to ask specific questions.\n`,
  );

  sections.push(buildTopicTrackingInstructions());

  return sections.join('\n\n');
}
