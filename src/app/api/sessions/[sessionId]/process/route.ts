import { NextRequest, NextResponse } from 'next/server';
import { runProcessingPipeline } from '@/lib/processing/pipeline';
import { getLatestArticleDraft } from '@/lib/orchestration/session-manager';
import type { PipelineOptions } from '@/lib/processing/pipeline';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json().catch(() => ({}));

    const options: PipelineOptions = {};

    if (body.skipTo === 'image_curation') {
      // Re-run only from image curation onward — reuse existing article + extraction
      const draft = await getLatestArticleDraft(sessionId);
      if (!draft) {
        return NextResponse.json(
          { error: 'No existing article draft found for partial re-run' },
          { status: 400 }
        );
      }
      options.skipTo = 'image_curation';
      options.existingArticle = draft.content;
      options.existingExtracted = draft.extraction_data ?? undefined;
    }

    await runProcessingPipeline(sessionId, options);

    return NextResponse.json({ ok: true, message: 'Processing complete' });
  } catch (error) {
    console.error('Failed to process session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}
