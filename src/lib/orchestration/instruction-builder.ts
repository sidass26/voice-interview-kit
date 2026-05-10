import type { IntakeResponse, DestinationResearch } from '../types';
import {
  buildInterviewerPersona,
  buildIntakeContext,
  buildResearchContext,
  buildItineraryContext,
} from '../prompts/interviewer';
import { buildTopicTrackingInstructions } from './topic-tracker';

/**
 * Builds the complete system instructions for the Realtime API session.
 * Combines: destination-aware persona + intake context + itinerary flow + research hints + topic tracking rules.
 */
export function buildInterviewInstructions(
  intake: IntakeResponse,
  research: DestinationResearch | null
): string {
  const sections: string[] = [
    buildInterviewerPersona(intake.destination_country, intake.destination_cities),
    buildIntakeContext(intake),
    buildItineraryContext(intake.itinerary || []),
  ];

  if (research) {
    sections.push(buildResearchContext(research));
  } else {
    sections.push(`
## RESEARCH NOTE
Background research on this destination is not yet available.
Use your general knowledge to ask destination-specific questions.
Focus on getting concrete details from the interviewee.
`);
  }

  sections.push(buildTopicTrackingInstructions());

  return sections.join('\n\n');
}
