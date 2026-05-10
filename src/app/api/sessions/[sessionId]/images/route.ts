import { NextRequest, NextResponse } from 'next/server';
import { updateIntakeImages } from '@/lib/orchestration/session-manager';
import type { TripImage } from '@/lib/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { images }: { images: TripImage[] } = await request.json();

    await updateIntakeImages(sessionId, images);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to update images:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update images' },
      { status: 500 }
    );
  }
}
