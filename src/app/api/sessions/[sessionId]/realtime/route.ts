import { NextRequest, NextResponse } from 'next/server';
import {
  getIntake,
  getResearch,
  updateSessionStatus,
} from '@/lib/orchestration/session-manager';
import { buildInterviewInstructions } from '@/lib/orchestration/instruction-builder';
import type { DestinationResearch } from '@/lib/types';

// GET: Create an ephemeral token for the Realtime API with baked-in instructions
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Fetch intake and research
    const [intake, researchSnapshot] = await Promise.all([
      getIntake(sessionId),
      getResearch(sessionId),
    ]);

    if (!intake) {
      return NextResponse.json({ error: 'No intake data found' }, { status: 404 });
    }

    const research = researchSnapshot?.research_data as DestinationResearch | null;

    // Build dynamic instructions
    const instructions = buildInterviewInstructions(intake, research ?? null);

    // Request ephemeral token from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'ash',
        instructions,
        input_audio_transcription: {
          model: 'gpt-4o-mini-transcribe',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.7,
          prefix_padding_ms: 500,
          silence_duration_ms: 1200,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI Realtime session error:', errText);
      return NextResponse.json(
        { error: 'Failed to create realtime session' },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Update session status
    await updateSessionStatus(sessionId, 'interviewing');

    return NextResponse.json({
      ephemeralKey: data.client_secret?.value,
      sessionId,
    });
  } catch (error) {
    console.error('Failed to create realtime token:', error);
    return NextResponse.json(
      { error: 'Failed to create realtime token' },
      { status: 500 }
    );
  }
}
