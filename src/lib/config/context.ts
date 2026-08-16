/**
 * Builds the InterviewContext object that is passed to every config builder
 * function (persona, research prompt, extraction prompt, output prompt).
 *
 * Phase B note: while the DB still stores travel-specific typed columns
 * (IntakeResponse), this helper reads the config's subjectNameField /
 * repeatingSection to derive context generically. Phase C will complete
 * the generalization once intake is stored as JSONB.
 */

import type { IntakeResponse } from '../types';
import { getConfig } from './index';
import type { InterviewContext } from './types';

/**
 * Build a runtime InterviewContext from a stored intake row plus optional
 * research data.
 *
 * @param intake   - Full intake row fetched from the DB.
 * @param research - Parsed research output, or null if not yet available.
 */
export function buildContext(
  intake: IntakeResponse,
  research: unknown | null = null,
): InterviewContext {
  const cfg = getConfig();
  const intakeData = intake as unknown as Record<string, unknown>;

  // Resolve subject name and email from config-specified field ids.
  const nameField  = cfg.intake.subjectNameField ?? 'employee_name';
  const emailField = 'work_email';

  // Rows live under the config's repeating-section id; `itinerary` is the
  // pre-generalization column name and stays as a fallback for older rows.
  const rs = cfg.intake.repeatingSection;
  const repeatingItems = ((rs ? intakeData[rs.id] : undefined) ??
    intake.itinerary ??
    []) as Record<string, unknown>[];

  // Derive unique values from the repeating section definition.
  const uniqueValues: Record<string, string[]> = {};
  if (rs?.extractUniqueValues) {
    const { fromField, toContextKey } = rs.extractUniqueValues;
    const rows = repeatingItems as Record<string, string>[];
    uniqueValues[toContextKey] = [...new Set(rows.map((r) => r[fromField]).filter(Boolean))];
  }
  // Ensure destination_cities is always available as ctx.uniqueValues.cities
  // for backward compatibility during the Phase B → C transition.
  uniqueValues.cities ??= intake.destination_cities ?? [];

  return {
    subject: {
      name:  (intakeData[nameField]  as string) ?? '',
      email: (intakeData[emailField] as string) ?? '',
    },
    intake:         intakeData,
    repeatingItems,
    uniqueValues,
    research,
  };
}
