import { NextRequest, NextResponse } from 'next/server';
import { getPayloadBySlug, getAuthorProfile } from '@/lib/orchestration/session-manager';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const outputPayload = await getPayloadBySlug(slug);

    if (!outputPayload) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Fetch intake for author email and trip details
    const supabase = createServerClient();
    const { data: intake } = await supabase
      .from('intake_responses')
      .select()
      .eq('session_id', outputPayload.session_id)
      .single();

    // Fetch author profile
    const author = intake?.work_email
      ? await getAuthorProfile(intake.work_email)
      : null;

    return NextResponse.json({
      payload: outputPayload.payload,
      featured_image_url: outputPayload.featured_image_url,
      image_placements: outputPayload.image_placements,
      published_at: outputPayload.published_at,
      publish_url: outputPayload.publish_url,
      slug: outputPayload.slug,
      author: author
        ? {
            name: author.employee_name,
            role: author.role,
            bio: author.bio,
            photo_url: author.photo_url,
            twitter: author.twitter,
            instagram: author.instagram,
            linkedin: author.linkedin,
          }
        : null,
      intake: intake
        ? {
            destination_country: intake.destination_country,
            destination_cities: intake.destination_cities,
            trip_purpose: intake.trip_purpose,
            trip_duration_days: intake.trip_duration_days,
          }
        : null,
    });
  } catch (error) {
    console.error('Failed to fetch article:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch article' },
      { status: 500 }
    );
  }
}
