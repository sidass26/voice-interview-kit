/**
 * voice-interview-kit — Config Type System
 *
 * Everything domain-specific about an interview deployment lives in a single
 * `interview.config.ts` file at the repo root. This module defines the full
 * type contract for that file.
 *
 * Engine code (WebRTC, Supabase, pipeline orchestration) reads from this config
 * at runtime and never hardcodes domain-specific prompts, schemas, or connectors.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Input field types supported by the dynamic intake form renderer. */
export type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'date'
  | 'select'
  | 'textarea'
  | 'url';

/** A single field in the intake form. */
export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  /** For `select` fields — the list of options. */
  options?: string[];
  /** For `textarea` fields. */
  maxLength?: number;
  /** For `number` fields. */
  min?: number;
  max?: number;
  /** Optional help text shown below the field. */
  helpText?: string;
}

/**
 * A repeating section in the intake form (e.g. day-by-day itinerary,
 * episode list, session log). Each row is a set of `itemFields`.
 */
export interface RepeatingSection {
  id: string;
  /** Displayed as the section heading (e.g. "Days", "Episodes"). */
  label: string;
  /** Label for the add-row button (e.g. "Add a day", "Add an episode"). */
  addButtonLabel: string;
  itemFields: FieldDefinition[];
  /**
   * Optionally derive the number of rows from a top-level number field.
   * The value is the `id` of a field in `IntakeConfig.fields` whose `type` is
   * `'number'`; whenever that field changes, the intake form grows or shrinks
   * this section to match, preserving any values already entered.
   *
   * Example: `rowCountFromField: 'trip_duration_days'` — a 5-day trip
   * automatically renders 5 itinerary rows.
   *
   * Rows can always also be added and removed manually via the add button.
   * Omit this to make the section purely manual.
   */
  rowCountFromField?: string;
  /**
   * Optionally extract unique values from one item field and expose them in
   * InterviewContext. Example: extract unique cities from each day's `city`
   * field → `ctx.uniqueValues.cities`.
   */
  extractUniqueValues?: {
    fromField: string;
    toContextKey: string;
  };
}

// ---------------------------------------------------------------------------
// Context — passed to all builder functions at runtime
// ---------------------------------------------------------------------------

/**
 * The runtime context object passed to every builder function (persona,
 * research prompt, extraction prompt, output prompt).
 *
 * Contains all data collected from the intake form, optional research output,
 * and convenience helpers derived from repeating sections.
 */
export interface InterviewContext {
  /** Convenience accessor — always the subject's name and email. */
  subject: {
    name: string;
    email: string;
    [key: string]: unknown;
  };
  /** The complete intake form data as a flat key-value map. */
  intake: Record<string, unknown>;
  /** All rows from the repeating section (e.g. itinerary days). */
  repeatingItems: Record<string, unknown>[];
  /**
   * Unique values extracted from repeating section rows, keyed by
   * `RepeatingSection.extractUniqueValues.toContextKey`.
   * e.g. `ctx.uniqueValues.cities` → `['Tokyo', 'Kyoto']`
   */
  uniqueValues: Record<string, string[]>;
  /** Structured research output if `research.enabled` is true, else null. */
  research: unknown | null;
}

// ---------------------------------------------------------------------------
// Config sections
// ---------------------------------------------------------------------------

/** Visual branding for the admin UI and interview pages. */
export interface BrandingConfig {
  /** Short name shown in the nav bar and page title. */
  appName: string;
  tagline?: string;
  /** Primary accent color (hex). Defaults to '#6B2AEA'. */
  primaryColor?: string;
  /** Path to a logo image served from /public. */
  logoUrl?: string;
}

/** Who is being interviewed (role label used throughout the UI). */
export interface SubjectConfig {
  /** Singular (e.g. "Traveler", "Founder", "Guest"). */
  label: string;
  /** Plural (e.g. "Travelers", "Founders", "Guests"). */
  plural: string;
  /**
   * Optional extra profile fields shown after the interview on the review
   * page (e.g. role, bio, social handles).
   */
  profileFields: FieldDefinition[];
}

/** Intake form configuration. */
export interface IntakeConfig {
  /** Top-level form fields. Must include fields whose `id` maps to
   *  `subject.name` (typically `employee_name`) and `subject.email`
   *  (typically `work_email`). */
  fields: FieldDefinition[];
  /** Optional repeating section (itinerary, episode list, etc.). */
  repeatingSection?: RepeatingSection;
  /**
   * Field id whose value becomes the human-readable "subject" label on
   * the sessions dashboard. Defaults to `employee_name`.
   */
  subjectNameField?: string;
  /**
   * Field id used as the interview "topic" label on the dashboard
   * (e.g. `destination_country`, `company_name`, `episode_title`).
   * Defaults to the first required text field after `subjectNameField`.
   */
  topicField?: string;
}

/** Optional pre-interview research phase powered by web-search AI. */
export interface ResearchConfig {
  enabled: boolean;
  /**
   * When true, the "Start Interview" button stays disabled until research
   * completes. Set false only if research is informational and the interview
   * should not wait for it. (Recommended: true)
   */
  blocksInterviewStart: boolean;
  /**
   * Returns the full research prompt to send to the web-search model.
   * The model will run live web searches and return structured JSON.
   * Typically uses `ctx.intake` and `ctx.uniqueValues` to make the
   * prompt destination/topic-specific.
   */
  promptBuilder: (ctx: InterviewContext) => string;
  /**
   * Optional hint describing the expected JSON shape returned by the research
   * model. Not enforced at runtime yet — treated as documentation for prompt
   * authors. Validated enforcement is planned for a future release.
   */
  responseSchemaHint?: Record<string, unknown>;
  /**
   * System instructions for the research AI (the web-search model).
   * Defaults to a generic "search for real community discussions" prompt.
   */
  systemInstructions?: string;
}

/** A single phase in the structured interview flow. */
export interface InterviewPhase {
  /** Short machine-readable id (e.g. 'overview', 'deep_dive', 'close'). */
  id: string;
  /** Human-readable label shown in progress UI. */
  label: string;
  /**
   * Instruction injected into the interviewer's system prompt describing
   * the goal of this phase and how to transition into it.
   */
  instruction: string;
}

/** Voice interview configuration — persona, phases, and model settings. */
export interface InterviewerConfig {
  /**
   * OpenAI Realtime voice.
   * Options: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'verse'
   */
  voice: string;
  /**
   * Realtime model. Pin to a date-versioned ID for stability.
   * Default: 'gpt-4o-realtime-preview'
   */
  realtimeModel: string;
  /**
   * Transcription model for user audio.
   * CRITICAL: Must remain set — without this, user speech is never transcribed
   * and the extraction model hallucinates answers from interviewer questions.
   * Default: 'gpt-4o-mini-transcribe'
   */
  transcriptionModel: string;
  /**
   * Builds the interviewer persona — the opening block of the system prompt.
   * Should define: who the bot is, its motivation, conversation style, and
   * mandatory topic rules.
   */
  personaBuilder: (ctx: InterviewContext) => string;
  /**
   * Ordered list of interview phases. The bot receives all phase instructions
   * upfront and is expected to progress through them naturally.
   */
  phases: InterviewPhase[];
  /** Soft target for interview length. Shown on the interview start screen. */
  targetDurationMin?: number;
}

/** Structured data extraction from the cleaned transcript. */
export interface ExtractionConfig {
  /**
   * Builds the extraction prompt. Should instruct the model to return a JSON
   * object containing the structured facts from `transcript`. Use
   * `ctx.intake` and `ctx.uniqueValues` to make the prompt topic-specific.
   *
   * IMPORTANT: The prompt should include the `_evidenceLog` requirement —
   * each extracted fact must cite a verbatim quote from the transcript.
   * This is enforced by the engine when `requireEvidenceLog` is true.
   */
  promptBuilder: (transcript: string, ctx: InterviewContext) => string;
  /**
   * When true (recommended), the engine validates that `_evidenceLog` is
   * present and non-empty in the extraction output. Prevents the model from
   * fabricating facts that have no transcript support.
   */
  requireEvidenceLog: boolean;
}

/** A single output artifact generated from the extracted data. */
export interface OutputConfig {
  /** Machine-readable id (e.g. 'article', 'report', 'summary'). */
  id: string;
  /** Human-readable label shown in the review UI (e.g. 'Travel Article'). */
  label: string;
  /** Output format. 'markdown' is recommended for article-style outputs. */
  format: 'markdown' | 'html' | 'json' | 'text';
  /**
   * Builds the generation prompt. `extracted` is the parsed JSON from the
   * extraction step. `transcript` is the cleaned interview text.
   */
  promptBuilder: (
    extracted: Record<string, unknown>,
    transcript: string,
    ctx: InterviewContext
  ) => string;
  /**
   * Generation model to use. Defaults to 'gpt-4.1' if not specified.
   * Can override per-output for cost/quality tradeoffs.
   */
  model?: string;
}

/** Built-in connector identifiers. */
export type ConnectorId = 'wordpress' | 'notion' | 'slack' | 'webhook';

/**
 * A connector publishes a generated output to an external platform.
 * Connector credentials are read from environment variables — values in
 * `envKeys` are env var names, not the secrets themselves.
 */
export interface ConnectorConfig {
  id: ConnectorId;
  /** Which output artifact (by `OutputConfig.id`) this connector publishes. */
  outputId: string;
  /** Set to false to disable without removing the block. */
  enabled: boolean;
  /**
   * Maps each credential to its environment variable name.
   * The engine reads `process.env[envKeys.xxx]` at publish time.
   *
   * WordPress:  { apiUrl, username, appPassword }
   * Notion:     { token, databaseId }
   * Slack:      { botToken, channelId }
   * Webhook:    { url }
   */
  envKeys: Record<string, string>;
}

/** Bulk-invite campaign configuration. */
export interface CampaignConfig {
  /** Enable the /admin/campaigns UI and /i/[token] invitee route. */
  enabled: boolean;
  /** How long an invitation link stays valid before it expires. */
  tokenTTL: '7d' | '30d' | '90d' | 'never';
  /**
   * When true, the standard /intake route works without an invitation token
   * (open access). When false, intake requires a valid /i/[token] link.
   */
  allowAnonymous: boolean;
  /**
   * Column names expected in uploaded CSVs beyond the required `name` and
   * `email` columns. Extra columns land in `contact.metadata` as JSONB and
   * are available via `ctx.subject` in prompt builders.
   */
  csvFields: string[];
}

// ---------------------------------------------------------------------------
// Root config
// ---------------------------------------------------------------------------

/**
 * The complete configuration for a voice-interview-kit deployment.
 * Export a `config` constant of this type from `interview.config.ts`.
 */
export interface InterviewConfig {
  branding: BrandingConfig;
  subject: SubjectConfig;
  intake: IntakeConfig;
  /** Omit or set `enabled: false` to skip the research phase entirely. */
  research?: ResearchConfig;
  interview: InterviewerConfig;
  extraction: ExtractionConfig;
  /**
   * One or more output artifacts generated from each completed interview.
   * The first output is treated as the primary artifact in the review UI.
   * The engine throws at startup if this array is empty.
   */
  outputs: OutputConfig[];
  /**
   * External publish targets. Credentials live in env vars — see ConnectorConfig.
   * Omit entirely if you don't need auto-publishing.
   */
  connectors?: ConnectorConfig[];
  /** Omit or set `enabled: false` to disable bulk-invite campaigns. */
  campaigns?: CampaignConfig;
}
