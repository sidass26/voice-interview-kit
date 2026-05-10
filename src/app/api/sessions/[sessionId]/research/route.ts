import { NextRequest, NextResponse } from 'next/server';
import { getIntake, getResearch } from '@/lib/orchestration/session-manager';

// GET: Get research data for a session
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const research = await getResearch(sessionId);

    if (!research) {
      // Check if we have intake to know if research should exist
      const intake = await getIntake(sessionId);
      if (!intake) {
        return NextResponse.json({ error: 'No intake data found' }, { status: 404 });
      }
      return NextResponse.json({ status: 'pending', message: 'Research not yet available' });
    }

    return NextResponse.json(research);
  } catch (error) {
    console.error('Failed to get research:', error);
    return NextResponse.json(
      { error: 'Failed to get research' },
      { status: 500 }
    );
  }
}
