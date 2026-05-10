import { NextResponse } from 'next/server';
import { listPublishedStories } from '@/lib/orchestration/session-manager';

export async function GET() {
  try {
    const stories = await listPublishedStories();
    return NextResponse.json(stories);
  } catch (error) {
    console.error('Failed to list stories:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list stories' },
      { status: 500 }
    );
  }
}
