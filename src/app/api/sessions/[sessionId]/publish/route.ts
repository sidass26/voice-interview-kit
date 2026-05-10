import { NextRequest, NextResponse } from 'next/server';
import {
  getOutputPayload,
  updatePublishStatus,
} from '@/lib/orchestration/session-manager';
import { publishToWordPress } from '@/lib/publishing/wordpress-publisher';
import type { WordPressConfig } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const platform: 'wordpress' | 'custom' = body.platform ?? 'custom';

    const outputPayload = await getOutputPayload(sessionId);
    if (!outputPayload) {
      return NextResponse.json({ error: 'No output payload found' }, { status: 404 });
    }

    let publishUrl: string;

    const slug: string = outputPayload.slug ?? outputPayload.payload?.slug ?? '';

    if (platform === 'custom') {
      // Mark as published on custom domain
      publishUrl = `/articles/${slug}`;
    } else {
      // Publish to WordPress
      const wpConfig: WordPressConfig = body.wordpressConfig;
      if (!wpConfig?.apiUrl || !wpConfig?.username || !wpConfig?.appPassword) {
        return NextResponse.json(
          { error: 'wordpressConfig (apiUrl, username, appPassword) required' },
          { status: 400 }
        );
      }

      const result = await publishToWordPress(
        outputPayload.payload,
        wpConfig,
        outputPayload.featured_image_url
      );
      publishUrl = result.postUrl;
    }

    const published_at = new Date().toISOString();
    await updatePublishStatus(sessionId, {
      publish_url: publishUrl,
      publish_platform: platform,
      published_at,
      slug: slug || undefined,
    });

    return NextResponse.json({ ok: true, publishUrl, published_at });
  } catch (error) {
    console.error('Failed to publish:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publish failed' },
      { status: 500 }
    );
  }
}
