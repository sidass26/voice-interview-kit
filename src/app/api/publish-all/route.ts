import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  getOutputPayload,
  updatePublishStatus,
} from '@/lib/orchestration/session-manager';
import { publishToWordPress } from '@/lib/publishing/wordpress-publisher';
import type { WordPressConfig } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionIds,
      publishAll = false,
      platform = 'custom',
      wordpressConfig,
    }: {
      sessionIds?: string[];
      publishAll?: boolean;
      platform?: 'wordpress' | 'custom';
      wordpressConfig?: WordPressConfig;
    } = body;

    if (platform === 'wordpress' && (!wordpressConfig?.apiUrl || !wordpressConfig?.username || !wordpressConfig?.appPassword)) {
      return NextResponse.json(
        { error: 'wordpressConfig required for WordPress publish' },
        { status: 400 }
      );
    }

    // Determine which sessions to publish
    let targetIds: string[] = sessionIds ?? [];

    if (publishAll) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('interview_sessions')
        .select(`
          id,
          output_payloads!inner(published_at, slug)
        `)
        .eq('status', 'completed')
        .is('output_payloads.published_at', null)
        .not('output_payloads.slug', 'is', null);

      if (error) throw new Error(error.message);
      targetIds = (data ?? []).map((row: any) => row.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ published: 0, failed: [], results: [] });
    }

    const results: Array<{ sessionId: string; publishUrl: string; published_at: string }> = [];
    const failed: string[] = [];

    await Promise.allSettled(
      targetIds.map(async (sessionId) => {
        try {
          const outputPayload = await getOutputPayload(sessionId);
          if (!outputPayload) throw new Error('No payload');

          let publishUrl: string;

          if (platform === 'custom') {
            publishUrl = `/articles/${outputPayload.slug ?? outputPayload.payload.slug}`;
          } else {
            const result = await publishToWordPress(
              outputPayload.payload,
              wordpressConfig!,
              outputPayload.featured_image_url
            );
            publishUrl = result.postUrl;
          }

          const published_at = new Date().toISOString();
          await updatePublishStatus(sessionId, {
            publish_url: publishUrl,
            publish_platform: platform,
            published_at,
          });

          results.push({ sessionId, publishUrl, published_at });
        } catch (err) {
          console.error(`Publish failed for ${sessionId}:`, err);
          failed.push(sessionId);
        }
      })
    );

    return NextResponse.json({
      published: results.length,
      failed,
      results,
    });
  } catch (error) {
    console.error('Bulk publish failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk publish failed' },
      { status: 500 }
    );
  }
}
