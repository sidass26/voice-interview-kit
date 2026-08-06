// ---- Session Status ----
export type SessionStatus =
  | 'intake'
  | 'researching'
  | 'ready'
  | 'interviewing'
  | 'processing'
  | 'completed'
  | 'failed';

// ---- Database Row Types ----
export interface InterviewSession {
  id: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  /** Set at session creation — identifies the config that created this session. */
  config_version: string | null;
}

export interface IntakeResponse {
  id: string;
  session_id: string;
  created_at: string;
  /**
   * The full intake payload as submitted by the user (migration 004+).
   * This is the primary source of truth for sessions created after 004.
   * All fields from the config's intake form are present here.
   */
  data?: Record<string, unknown>;
  // ── Travel-specific typed columns (kept for backward compat) ──────────────
  // Present on legacy sessions (pre-004). On new sessions these are
  // derived from `data` by getIntake() so callers always see them.
  employee_name: string;
  work_email: string;
  destination_country: string;
  destination_cities: string[];
  trip_type: string;
  trip_purpose: string;
  num_travelers: number;
  trip_duration_days: number;
  trip_start_date: string | null;
  trip_end_date: string | null;
  itinerary: ItineraryDay[];
  images: TripImage[];
}

export interface AuthorProfile {
  id: string;
  work_email: string;
  employee_name: string;
  role: string | null;
  bio: string | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  twitter: string | null;
  instagram: string | null;
  linkedin: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchSnapshot {
  id: string;
  session_id: string;
  destination: string;
  research_data: DestinationResearch;
  created_at: string;
}

export interface Transcript {
  id: string;
  session_id: string;
  raw_entries: TranscriptEntry[];
  cleaned_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleDraft {
  id: string;
  session_id: string;
  version: number;
  content: string;
  extraction_data: ExtractedData | null;
  created_at: string;
}

export interface OutputPayload {
  id: string;
  session_id: string;
  payload: WordPressPayload;
  status: 'draft' | 'reviewed' | 'published';
  slug: string | null;
  featured_image_url: string | null;
  image_placements: ImagePlacement[];
  published_at: string | null;
  publish_url: string | null;
  publish_platform: 'wordpress' | 'custom' | null;
  created_at: string;
  updated_at: string;
}

// ---- Images ----
export interface TripImage {
  url: string;
  storagePath: string;
  description: string;
  day?: number;
}

export interface ImagePlacement {
  url: string;
  insertAfterParagraph: number;
  caption?: string;
}

export interface ImageCurationResult {
  featuredImageUrl: string | null;
  placements: ImagePlacement[];
}

// ---- Author Profile (intake form shape) ----
export interface AuthorProfileFormData {
  role: string;
  bio: string;
  photo_url: string | null;
  photo_storage_path: string | null;
  twitter: string;
  instagram: string;
  linkedin: string;
}

// ---- Globe / Public Stories ----
export interface StoryPreview {
  sessionId: string;
  slug: string;
  destination_country: string;
  destination_cities: string[];
  title: string;
  excerpt: string;
  featured_image_url: string | null;
  author_name: string;
  author_photo_url: string | null;
  author_role: string | null;
  travel_month: string;
  trip_purpose: string;
  trip_duration: string;
  published_at: string | null;
  created_at: string;
}

// ---- Publishing ----
export interface WordPressConfig {
  apiUrl: string;
  username: string;
  appPassword: string;
}

export interface PublishResult {
  sessionId: string;
  platform: 'wordpress' | 'custom';
  publishUrl: string;
  publishedAt: string;
}

// ---- Itinerary ----
export interface ItineraryDay {
  day: number;
  city: string;
  notes: string;
}

// ---- Intake Form ----
export interface IntakeFormData {
  employee_name: string;
  work_email: string;
  destination_country: string;
  destination_cities: string[]; // computed from itinerary
  trip_type: string;
  trip_purpose: string;
  num_travelers: number;
  trip_duration_days: number;
  trip_start_date: string | null;
  trip_end_date: string | null;
  itinerary: ItineraryDay[];
  images: TripImage[];
}

// ---- Transcript ----
export interface TranscriptEntry {
  role: 'interviewer' | 'interviewee';
  text: string;
  timestamp: number; // seconds from session start
}

// ---- Research ----
export interface BucketHints {
  hints: string[];
}

export interface CityResearchHints {
  food: string[];
  activities: string[];
  tips: string[];
  commonMistakes: string[];
}

export interface DestinationResearch {
  destination: string;
  summary: string;
  bucketHints: {
    trip_overview: BucketHints;
    highlights: BucketHints;
    disappointments: BucketHints;
    food: BucketHints;
    restaurants: BucketHints;
    logistics: BucketHints;
    budget: BucketHints;
    mistakes: BucketHints;
    practical_tips: BucketHints;
  };
  uniqueAngles: string[];
  redditQuestions: string[];
  cityResearch?: Record<string, CityResearchHints>;
}

// ---- Topic Tracker ----
export type TopicDepth = 'none' | 'shallow' | 'deep';

export interface TopicBucket {
  covered: boolean;
  depth: TopicDepth;
}

export const TOPIC_BUCKET_KEYS = [
  'trip_overview',
  'highlights',
  'disappointments',
  'food',
  'restaurants',
  'logistics',
  'budget',
  'mistakes',
  'who_its_for',
  'practical_tips',
  'closing',
] as const;

export type TopicBucketKey = (typeof TOPIC_BUCKET_KEYS)[number];

export type TopicBuckets = Record<TopicBucketKey, TopicBucket>;

// ---- Extraction ----
export interface DayExtraction {
  day: number;
  city: string;
  highlights: string[];
  food: string[];
  activities: string[];
  issues: string[];
}

export interface SuggestedArticle {
  title: string;
  type: 'destination' | 'city' | 'food' | 'budget' | 'itinerary';
  focusCities: string[];
  angle: string;
}

export interface ExtractedData {
  destination: string;
  cities: string[];
  tripDuration: string;
  travelMonth: string;
  travelParty: string;
  numTravelers: number;
  purpose: string;
  authorName: string;
  highlights: string[];
  disappointments: string[];
  foodMentions: string[];
  restaurantMentions: Array<{
    name: string;
    location: string;
    whatTheyHad: string;
    verdict: string;
  }>;
  budgetBreakdown: {
    total: string | null;
    flights: string | null;
    hotels: string | null;
    food: string | null;
    experiences: string | null;
  };
  dayByDay: DayExtraction[];
  suggestedArticles: SuggestedArticle[];
  mistakes: string[];
  tips: string[];
  whoItsFor: string;
  bestTimeToVisit: string;
  overallVerdict: string;
}

// ---- WordPress Payload ----
export interface WordPressPayload {
  title: string;
  slug: string;
  content: string; // HTML
  excerpt: string;
  status: 'draft';
  author_name: string;
  categories: string[];
  tags: string[];
  featured_image_url: string | null;
  image_placements: ImagePlacement[];
  meta: {
    destination_country: string;
    destination_cities: string[];
    trip_duration: string;
    travel_month: string;
    budget_total: string;
  };
}
