import { NextRequest, NextResponse } from 'next/server';
import {
  createSession,
  saveIntake,
  updateSessionStatus,
  listSessions,
  getIntake,
} from '@/lib/orchestration/session-manager';
import { runDestinationResearch } from '@/lib/research/research-service';
import { getConfig } from '@/lib/config/index';
import { saveResearch } from '@/lib/orchestration/session-manager';
import type { IntakeFormData } from '@/lib/types';
import type { InterviewConfig } from '@/lib/config/types';

/**
 * Human-readable label for the research snapshot, derived from the config's
 * `topicField` plus whatever the repeating section extracts (e.g. cities).
 * Falls back progressively so a config with neither configured still runs.
 */
function buildResearchLabel(
  payload: Record<string, unknown>,
  cfg: InterviewConfig,
): string {
  const topic = cfg.intake.topicField
    ? String(payload[cfg.intake.topicField] ?? '').trim()
    : '';

  const contextKey = cfg.intake.repeatingSection?.extractUniqueValues?.toContextKey;
  const values = contextKey && Array.isArray(payload[contextKey])
    ? (payload[contextKey] as string[]).filter(Boolean)
    : [];

  if (topic && values.length) return `${topic} — ${values.join(', ')}`;
  if (topic) return topic;
  if (values.length) return values.join(', ');
  return 'Interview';
}

// POST: Create a new session with intake data, trigger research
export async function POST(request: NextRequest) {
  try {
    const body: IntakeFormData = await request.json();

    // Create session
    const session = await createSession();

    // Save intake
    await saveIntake(session.id, body);

    // Update status to researching
    await updateSessionStatus(session.id, 'researching');

    // Trigger research in background — don't await, fires async.
    const cfg = getConfig();
    if (cfg.research?.enabled) {
      const destination = buildResearchLabel(body as unknown as Record<string, unknown>, cfg);
      runDestinationResearch(body)
        .then(async (research) => {
          await saveResearch(session.id, destination, research as Record<string, unknown>);
          await updateSessionStatus(session.id, 'ready');
          console.log(`[Research] Completed for session ${session.id}`);
        })
        .catch(async (err) => {
          console.error(`[Research] Failed for session ${session.id}:`, err);
          await updateSessionStatus(session.id, 'ready');
        });
    } else {
      // No research phase — go straight to ready.
      await updateSessionStatus(session.id, 'ready');
    }

    return NextResponse.json({ sessionId: session.id }, { status: 201 });
  } catch (error) {
    console.error('Failed to create session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create session' },
      { status: 500 }
    );
  }
}

// GET: List all sessions with their intake data
export async function GET() {
  try {
    const sessions = await listSessions();

    // Fetch intake data for each session
    const sessionsWithIntake = await Promise.all(
      sessions.map(async (session) => {
        const intake = await getIntake(session.id);
        return { ...session, intake };
      })
    );

    return NextResponse.json(sessionsWithIntake);
  } catch (error) {
    console.error('Failed to list sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}
