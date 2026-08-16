import { NextRequest, NextResponse } from 'next/server';
import { upsertAuthorProfile, getAuthorProfile } from '@/lib/orchestration/session-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // TODO: `profile` is spread straight into the author_profiles upsert, so
    // config.subject.profileFields ids are load-bearing — they must match the
    // table's columns (role, bio, twitter, instagram, linkedin). A config with
    // different ids will fail this write. Generalizing needs a JSONB column
    // here, the same way intake_responses.data works.
    const { work_email, employee_name, ...profile } = body;

    if (!work_email || !employee_name) {
      return NextResponse.json({ error: 'work_email and employee_name required' }, { status: 400 });
    }

    const author = await upsertAuthorProfile(work_email, employee_name, profile);
    return NextResponse.json(author);
  } catch (error) {
    console.error('Failed to save author profile:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save author profile' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'email parameter required' }, { status: 400 });
    }

    const author = await getAuthorProfile(email);
    if (!author) {
      return NextResponse.json({ error: 'Author profile not found' }, { status: 404 });
    }

    return NextResponse.json(author);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get author profile' },
      { status: 500 }
    );
  }
}
