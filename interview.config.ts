/**
 * interview.config.ts — The single file you edit to configure your deployment.
 *
 * This file defines everything domain-specific about your interview:
 *   - Who gets interviewed and what you collect in the intake form
 *   - The AI researcher's web-search prompt
 *   - The voice bot's persona and interview structure
 *   - The extraction schema (what facts to pull from the transcript)
 *   - What output(s) to generate (article, report, summary…)
 *   - Which connectors to publish to (WordPress, Notion, Slack, webhook)
 *   - Whether to enable bulk-invite campaigns
 *
 * STATUS — read before relying on a field below.
 * The engine currently reads only a subset of this config: the four
 * prompt builders (research, persona, extraction, output), the model and
 * voice settings, `research.enabled`, `intake.subjectNameField`, and
 * `intake.repeatingSection`. The remaining fields — branding, subject
 * labels, `intake.fields`, `interview.phases`, connectors, campaigns —
 * are declared and typed but NOT yet consumed; the UI still hardcodes
 * their travel equivalents. Swapping this file alone will not change the
 * use case yet. See the Roadmap in README.md for the wiring order.
 *
 * ---------------------------------------------------------------------------
 * CURRENT CONFIG: Travel Stories
 * Interviews employees about recent trips → generates first-person articles
 * ---------------------------------------------------------------------------
 */

import type { InterviewConfig, InterviewContext } from './src/lib/config/types';

// Existing prompt builders — these stay in src/lib/prompts/ and are called
// from this config. In Phase B, the engine will call config methods instead
// of these functions directly. For now they coexist.
import { buildInterviewerPersona } from './src/lib/prompts/interviewer';
import { buildResearchPrompt } from './src/lib/prompts/research';
import { buildExtractionPrompt } from './src/lib/prompts/extraction';
import { buildArticlePrompt } from './src/lib/prompts/article';

// Travel-specific types — used for casting in prompt builders below.
// Non-travel configs will import their own domain types instead.
import type { IntakeResponse, ExtractedData } from './src/lib/types';

// ---------------------------------------------------------------------------
// Static data (no runtime dependency — defined once, referenced in config)
// ---------------------------------------------------------------------------

const TRAVEL_PHASES = [
  {
    id: 'overview',
    label: 'Overview',
    instruction: 'Start with trip context — how the trip came about, general vibe, initial impressions. 2-3 minutes max.',
  },
  {
    id: 'day_by_day',
    label: 'Day by day',
    instruction: 'Walk through each city block from the itinerary in order. For each city, ask what they did, where they ate, and what stood out. Use the CITY-SPECIFIC PROBES from the research context.',
  },
  {
    id: 'themes',
    label: 'Cross-cutting themes',
    instruction: 'Cover any mandatory topics not yet addressed: budget, negatives/disappointments, logistics, specific restaurant recs.',
  },
  {
    id: 'rapid_fire',
    label: 'Research rapid fire',
    instruction: 'Transition with: "We did some research before this — quick fire round, give me short answers." Then ask every MANDATORY PHASE 4 QUESTION from the research context, one at a time.',
  },
  {
    id: 'close',
    label: 'Close',
    instruction: '"That\'s super helpful — thanks! One last thing — if someone at your company was planning the same trip, what\'s the one thing you\'d tell them?" Thank them and end.',
  },
] as const satisfies import('./src/lib/config/types').InterviewPhase[];

// ---------------------------------------------------------------------------

export const config: InterviewConfig = {

  // ── Branding ──────────────────────────────────────────────────────────────
  branding: {
    appName: 'Travel Interview',
    tagline: 'Capture employee trips as first-person articles',
    primaryColor: '#6B2AEA',
  },

  // ── Subject ───────────────────────────────────────────────────────────────
  // "Who is being interviewed?" — label used throughout the UI and in prompts.
  subject: {
    label: 'Traveler',
    plural: 'Travelers',
    // Extra profile fields collected on the review page (after the interview).
    profileFields: [
      {
        id: 'role',
        label: 'Your role at [Company]',
        type: 'text',
        placeholder: 'Senior Product Manager',
      },
      {
        id: 'bio',
        label: 'Short bio',
        type: 'textarea',
        placeholder:
          "I'm a Product Manager who travels solo every few months. I care most about finding local food and avoiding tourist traps.",
        maxLength: 300,
      },
      { id: 'twitter',   label: 'Twitter / X handle', type: 'text', placeholder: '@username' },
      { id: 'instagram', label: 'Instagram handle',   type: 'text', placeholder: '@username' },
      { id: 'linkedin',  label: 'LinkedIn URL',        type: 'url',  placeholder: 'https://linkedin.com/in/...' },
    ],
  },

  // ── Intake form ───────────────────────────────────────────────────────────
  // Fields rendered in the intake form. Keep required fields minimal —
  // more fields = more friction = fewer completed interviews.
  intake: {
    subjectNameField: 'employee_name',
    topicField: 'destination_country',
    fields: [
      {
        id: 'employee_name',
        label: 'Your full name',
        type: 'text',
        placeholder: 'Alex Johnson',
        required: true,
      },
      {
        id: 'work_email',
        label: 'Work email',
        type: 'email',
        placeholder: 'jane@company.com',
        required: true,
      },
      {
        id: 'destination_country',
        label: 'Destination country',
        type: 'text',
        placeholder: 'Japan',
        required: true,
      },
      {
        id: 'trip_type',
        label: 'Trip in a nutshell',
        type: 'text',
        placeholder: '5 days in Tokyo and Kyoto, mostly food and temples',
        required: true,
      },
      {
        id: 'trip_purpose',
        label: 'Trip purpose',
        type: 'select',
        options: ['Holiday', 'Business', 'Bleisure', 'Adventure', 'Family', 'Other'],
        required: true,
      },
      {
        id: 'num_travelers',
        label: 'Number of travelers',
        type: 'number',
        min: 1,
        max: 20,
        required: true,
      },
      {
        id: 'trip_duration_days',
        label: 'Duration (days)',
        type: 'number',
        placeholder: '5',
        min: 1,
        max: 30,
        required: true,
      },
      { id: 'trip_start_date', label: 'Trip start date', type: 'date' },
      { id: 'trip_end_date',   label: 'Trip end date',   type: 'date' },
    ],
    // Day-by-day itinerary builder. Each row = one day.
    // Unique cities are auto-extracted and exposed as ctx.uniqueValues.cities.
    repeatingSection: {
      id: 'itinerary',
      label: 'Day-by-day itinerary',
      addButtonLabel: 'Add a day',
      itemFields: [
        {
          id: 'city',
          label: 'City',
          type: 'text',
          placeholder: 'Tokyo',
          required: true,
        },
        {
          id: 'notes',
          label: 'What happened',
          type: 'textarea',
          placeholder: 'Arrived late, explored Shibuya crossing, found great ramen...',
          maxLength: 200,
        },
      ],
      extractUniqueValues: {
        fromField: 'city',
        toContextKey: 'cities',
      },
      rowCountFromField: 'trip_duration_days',
    },
  },

  // ── Research ──────────────────────────────────────────────────────────────
  research: {
    enabled: true,
    blocksInterviewStart: true,
    systemInstructions:
      'You are a travel research assistant. Always search the web for real, current information. Focus especially on Reddit discussions for authentic traveler opinions.',
    promptBuilder: (ctx: InterviewContext): string => {
      const destination = ctx.intake.destination_country as string;
      const tripType    = ctx.intake.trip_type as string;
      const purpose     = ctx.intake.trip_purpose as string;
      return buildResearchPrompt(destination, ctx.uniqueValues.cities ?? [], tripType, purpose);
    },
  },

  // ── Interview ─────────────────────────────────────────────────────────────
  interview: {
    voice: 'alloy',
    realtimeModel: 'gpt-4o-realtime-preview',
    transcriptionModel: 'gpt-4o-mini-transcribe', // see CLAUDE.md Critical Decision #1
    targetDurationMin: 15,

    personaBuilder: (ctx: InterviewContext): string =>
      buildInterviewerPersona(
        ctx.intake.destination_country as string,
        ctx.uniqueValues.cities ?? [],
      ),

    phases: TRAVEL_PHASES,
  },

  // ── Extraction ────────────────────────────────────────────────────────────
  extraction: {
    requireEvidenceLog: true,
    promptBuilder: (transcript: string, ctx: InterviewContext): string =>
      buildExtractionPrompt(
        transcript,
        ctx.intake.destination_country as string,
        ctx.uniqueValues.cities ?? [],
      ),
  },

  // ── Outputs ───────────────────────────────────────────────────────────────
  outputs: [
    {
      id: 'article',
      label: 'Travel Article',
      format: 'markdown',
      promptBuilder: (extracted, transcript, ctx): string =>
        buildArticlePrompt(
          extracted as unknown as ExtractedData,
          transcript,
          ctx.intake as unknown as IntakeResponse,
        ),
    },
  ],

  // ── Connectors ────────────────────────────────────────────────────────────
  // Set `enabled: true` and add the corresponding env vars to publish
  // automatically after each completed interview.
  //
  // Credentials live in environment variables — never hardcode them here.
  // See .env.example for the full list.
  connectors: [
    {
      id: 'wordpress',
      outputId: 'article',
      enabled: false, // set to true + add env vars to activate
      envKeys: {
        apiUrl:      'WORDPRESS_URL',
        username:    'WORDPRESS_USERNAME',
        appPassword: 'WORDPRESS_APP_PASSWORD',
      },
    },
    {
      id: 'notion',
      outputId: 'article',
      enabled: false,
      envKeys: {
        token:      'NOTION_TOKEN',
        databaseId: 'NOTION_DATABASE_ID',
      },
    },
    {
      id: 'slack',
      outputId: 'article',
      enabled: false,
      envKeys: {
        botToken:  'SLACK_BOT_TOKEN',
        channelId: 'SLACK_CHANNEL_ID',
      },
    },
    {
      id: 'webhook',
      outputId: 'article',
      enabled: false,
      envKeys: {
        url: 'WEBHOOK_URL',
      },
    },
  ],

  // ── Campaigns ─────────────────────────────────────────────────────────────
  // Bulk-invite: upload a CSV of contacts → generate unique interview links
  // → export CSV for email forwarding → track completion per contact.
  campaigns: {
    enabled: false, // flip to true to activate /admin/campaigns + /i/[token]
    tokenTTL: '30d',
    allowAnonymous: true, // keep true so /intake still works without a link
    csvFields: ['name', 'email'], // add columns like 'destination', 'role' as needed
  },
};
