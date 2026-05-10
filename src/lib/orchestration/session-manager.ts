import { createServerClient } from '../supabase/server';
import type {
  InterviewSession,
  IntakeResponse,
  IntakeFormData,
  SessionStatus,
  ResearchSnapshot,
  Transcript,
  TranscriptEntry,
  ArticleDraft,
  OutputPayload,
  ExtractedData,
  WordPressPayload,
  AuthorProfile,
  AuthorProfileFormData,
  TripImage,
  ImagePlacement,
  StoryPreview,
} from '../types';

const supabase = () => createServerClient();

// ---- Session CRUD ----

export async function createSession(): Promise<InterviewSession> {
  const { data, error } = await supabase()
    .from('interview_sessions')
    .insert({})
    .select()
    .single();
  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data;
}

export async function getSession(sessionId: string): Promise<InterviewSession> {
  const { data, error } = await supabase()
    .from('interview_sessions')
    .select()
    .eq('id', sessionId)
    .single();
  if (error) throw new Error(`Failed to get session: ${error.message}`);
  return data;
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  extra?: Partial<InterviewSession>
): Promise<InterviewSession> {
  const { data, error } = await supabase()
    .from('interview_sessions')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw new Error(`Failed to update session: ${error.message}`);
  return data;
}

export async function listSessions(): Promise<InterviewSession[]> {
  const { data, error } = await supabase()
    .from('interview_sessions')
    .select()
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list sessions: ${error.message}`);
  return data;
}

// ---- Intake ----

export async function saveIntake(
  sessionId: string,
  formData: IntakeFormData
): Promise<IntakeResponse> {
  const { data, error } = await supabase()
    .from('intake_responses')
    .insert({ session_id: sessionId, ...formData })
    .select()
    .single();
  if (error) throw new Error(`Failed to save intake: ${error.message}`);
  return data;
}

export async function getIntake(sessionId: string): Promise<IntakeResponse | null> {
  const { data, error } = await supabase()
    .from('intake_responses')
    .select()
    .eq('session_id', sessionId)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get intake: ${error.message}`);
  return data;
}

export async function updateIntakeImages(
  sessionId: string,
  images: TripImage[]
): Promise<void> {
  const { error } = await supabase()
    .from('intake_responses')
    .update({ images })
    .eq('session_id', sessionId);
  if (error) throw new Error(`Failed to update intake images: ${error.message}`);
}

// ---- Author Profiles ----

export async function upsertAuthorProfile(
  workEmail: string,
  employeeName: string,
  profile: Partial<AuthorProfileFormData>
): Promise<AuthorProfile> {
  const { data, error } = await supabase()
    .from('author_profiles')
    .upsert(
      {
        work_email: workEmail,
        employee_name: employeeName,
        ...profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'work_email' }
    )
    .select()
    .single();
  if (error) throw new Error(`Failed to upsert author profile: ${error.message}`);
  return data;
}

export async function getAuthorProfile(workEmail: string): Promise<AuthorProfile | null> {
  const { data, error } = await supabase()
    .from('author_profiles')
    .select()
    .eq('work_email', workEmail)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get author profile: ${error.message}`);
  return data;
}

// ---- Research ----

export async function saveResearch(
  sessionId: string,
  destination: string,
  researchData: Record<string, unknown>
): Promise<ResearchSnapshot> {
  const { data, error } = await supabase()
    .from('research_snapshots')
    .insert({ session_id: sessionId, destination, research_data: researchData })
    .select()
    .single();
  if (error) throw new Error(`Failed to save research: ${error.message}`);
  return data;
}

export async function getResearch(sessionId: string): Promise<ResearchSnapshot | null> {
  const { data, error } = await supabase()
    .from('research_snapshots')
    .select()
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get research: ${error.message}`);
  return data;
}

// ---- Transcript ----

export async function createTranscript(sessionId: string): Promise<Transcript> {
  const { data, error } = await supabase()
    .from('transcripts')
    .insert({ session_id: sessionId, raw_entries: [] })
    .select()
    .single();
  if (error) throw new Error(`Failed to create transcript: ${error.message}`);
  return data;
}

export async function appendTranscriptEntries(
  sessionId: string,
  entries: TranscriptEntry[]
): Promise<Transcript> {
  const existing = await getTranscript(sessionId);
  const currentEntries = existing?.raw_entries || [];
  const merged = [...currentEntries, ...entries];

  if (existing) {
    const { data, error } = await supabase()
      .from('transcripts')
      .update({ raw_entries: merged, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update transcript: ${error.message}`);
    return data;
  } else {
    return createTranscriptWithEntries(sessionId, merged);
  }
}

async function createTranscriptWithEntries(
  sessionId: string,
  entries: TranscriptEntry[]
): Promise<Transcript> {
  const { data, error } = await supabase()
    .from('transcripts')
    .insert({ session_id: sessionId, raw_entries: entries })
    .select()
    .single();
  if (error) throw new Error(`Failed to create transcript: ${error.message}`);
  return data;
}

export async function getTranscript(sessionId: string): Promise<Transcript | null> {
  const { data, error } = await supabase()
    .from('transcripts')
    .select()
    .eq('session_id', sessionId)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get transcript: ${error.message}`);
  return data;
}

export async function updateTranscriptCleanedText(
  sessionId: string,
  cleanedText: string
): Promise<void> {
  const { error } = await supabase()
    .from('transcripts')
    .update({ cleaned_text: cleanedText, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId);
  if (error) throw new Error(`Failed to update cleaned transcript: ${error.message}`);
}

// ---- Article Drafts ----

export async function saveArticleDraft(
  sessionId: string,
  content: string,
  extractionData: ExtractedData
): Promise<ArticleDraft> {
  const { data: existing } = await supabase()
    .from('article_drafts')
    .select('version')
    .eq('session_id', sessionId)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1;

  const { data, error } = await supabase()
    .from('article_drafts')
    .insert({
      session_id: sessionId,
      version: nextVersion,
      content,
      extraction_data: extractionData,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to save article draft: ${error.message}`);
  return data;
}

export async function getLatestArticleDraft(sessionId: string): Promise<ArticleDraft | null> {
  const { data, error } = await supabase()
    .from('article_drafts')
    .select()
    .eq('session_id', sessionId)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get article: ${error.message}`);
  return data;
}

// ---- Output Payloads ----

export async function saveOutputPayload(
  sessionId: string,
  payload: WordPressPayload,
  extras?: {
    slug?: string;
    featuredImageUrl?: string | null;
    imagePlacements?: ImagePlacement[];
  }
): Promise<OutputPayload> {
  const { data, error } = await supabase()
    .from('output_payloads')
    .insert({
      session_id: sessionId,
      payload,
      slug: extras?.slug ?? payload.slug,
      featured_image_url: extras?.featuredImageUrl ?? payload.featured_image_url ?? null,
      image_placements: extras?.imagePlacements ?? payload.image_placements ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to save payload: ${error.message}`);
  return data;
}

export async function getOutputPayload(sessionId: string): Promise<OutputPayload | null> {
  const { data, error } = await supabase()
    .from('output_payloads')
    .select()
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get payload: ${error.message}`);
  return data;
}

export async function getPayloadBySlug(slug: string): Promise<OutputPayload | null> {
  const { data, error } = await supabase()
    .from('output_payloads')
    .select()
    .eq('slug', slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get payload by slug: ${error.message}`);
  return data;
}

export async function updatePublishStatus(
  sessionId: string,
  publishData: {
    publish_url: string;
    publish_platform: 'wordpress' | 'custom';
    published_at: string;
    slug?: string;
  }
): Promise<void> {
  const { error } = await supabase()
    .from('output_payloads')
    .update({
      ...publishData,
      status: 'published',
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId);
  if (error) throw new Error(`Failed to update publish status: ${error.message}`);
}

// ---- Public stories (globe API) ----

export async function listPublishedStories(): Promise<StoryPreview[]> {
  // Fetch all completed sessions with payload + intake + author profile
  const { data, error } = await supabase()
    .from('interview_sessions')
    .select(`
      id,
      created_at,
      intake_responses!inner(
        employee_name,
        work_email,
        destination_country,
        destination_cities,
        trip_purpose
      ),
      output_payloads!inner(
        slug,
        featured_image_url,
        published_at,
        payload
      )
    `)
    .eq('status', 'completed')
    .not('output_payloads.slug', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list stories: ${error.message}`);
  if (!data) return [];

  const stories: StoryPreview[] = [];

  for (const row of data as any[]) {
    const intake = Array.isArray(row.intake_responses)
      ? row.intake_responses[0]
      : row.intake_responses;
    const outputPayload = Array.isArray(row.output_payloads)
      ? row.output_payloads[0]
      : row.output_payloads;

    if (!intake || !outputPayload?.slug) continue;

    const payload = outputPayload.payload as WordPressPayload;

    // Fetch author profile separately (by email)
    const author = await getAuthorProfile(intake.work_email);

    stories.push({
      sessionId: row.id,
      slug: outputPayload.slug,
      destination_country: intake.destination_country,
      destination_cities: intake.destination_cities,
      title: payload.title,
      excerpt: payload.excerpt,
      featured_image_url: outputPayload.featured_image_url ?? null,
      author_name: intake.employee_name,
      author_photo_url: author?.photo_url ?? null,
      author_role: author?.role ?? null,
      travel_month: payload.meta?.travel_month ?? '',
      trip_purpose: intake.trip_purpose,
      trip_duration: payload.meta?.trip_duration ?? '',
      published_at: outputPayload.published_at ?? null,
      created_at: row.created_at,
    });
  }

  return stories;
}

// ---- Full session data (for review page) ----

export async function getFullSessionData(sessionId: string) {
  const [session, intake, research, transcript, article, payload] = await Promise.all([
    getSession(sessionId),
    getIntake(sessionId),
    getResearch(sessionId),
    getTranscript(sessionId),
    getLatestArticleDraft(sessionId),
    getOutputPayload(sessionId),
  ]);
  return { session, intake, research, transcript, article, payload };
}
