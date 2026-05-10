import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { content } = await request.json();

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'content must be a string' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Update the most recent article_draft for this session
    const { data, error } = await supabase
      .from('article_drafts')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .order('version', { ascending: false })
      .limit(1)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update article' },
      { status: 500 }
    );
  }
}
