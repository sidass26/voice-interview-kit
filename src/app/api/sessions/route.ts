import { NextRequest, NextResponse } from 'next/server';
import {
  createSession,
  saveIntake,
  updateSessionStatus,
  listSessions,
  getIntake,
} from '@/lib/orchestration/session-manager';
import { runDestinationResearch } from '@/lib/research/research-service';
import { saveResearch } from '@/lib/orchestration/session-manager';
import type { IntakeFormData } from '@/lib/types';

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

    // Trigger research in background (don't await — it'll complete async)
    // Extract unique cities from itinerary if available, otherwise use destination_cities
    const cities = body.destination_cities;
    const destination = `${body.destination_country} — ${cities.join(', ')}`;
    runDestinationResearch(
      body.destination_country,
      cities,
      body.trip_type,
      body.trip_purpose
    )
      .then(async (research) => {
        await saveResearch(session.id, destination, research as unknown as Record<string, unknown>);
        await updateSessionStatus(session.id, 'ready');
        console.log(`[Research] Completed for session ${session.id}`);
      })
      .catch(async (err) => {
        console.error(`[Research] Failed for session ${session.id}:`, err);
        // Still mark as ready — interview can proceed without research
        await updateSessionStatus(session.id, 'ready');
      });

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
