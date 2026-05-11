import {
  getIntake,
  getTranscript,
  getResearch,
  updateTranscriptCleanedText,
  saveArticleDraft,
  saveOutputPayload,
  updateSessionStatus,
} from '../orchestration/session-manager';
import { cleanTranscript } from './transcript-cleaner';
import { extractStructuredData } from './extractor';
import { generateArticle } from './article-generator';
import { buildWordPressPayload } from './payload-builder';
import { curateImages } from './image-curator';
import { buildContext } from '../config/context';
import type { ExtractedData, ImagePlacement } from '../types';

export interface PipelineOptions {
  // Skip to a later step (used when re-running after image upload)
  skipTo?: 'image_curation';
  // Pre-supply already-generated data when skipping early steps
  existingArticle?: string;
  existingExtracted?: ExtractedData;
}

export async function runProcessingPipeline(
  sessionId: string,
  options: PipelineOptions = {},
): Promise<void> {
  try {
    await updateSessionStatus(sessionId, 'processing');

    const [intake, transcript, researchSnapshot] = await Promise.all([
      getIntake(sessionId),
      getTranscript(sessionId),
      getResearch(sessionId),
    ]);

    if (!intake) throw new Error('No intake data found for session');

    const ctx = buildContext(intake, researchSnapshot?.research_data ?? null);

    let cleanedText: string;
    let extracted: Record<string, unknown>;
    let article: string;

    if (options.skipTo === 'image_curation') {
      if (!options.existingArticle || !options.existingExtracted) {
        throw new Error('existingArticle and existingExtracted required when skipTo=image_curation');
      }
      cleanedText = transcript?.cleaned_text ?? '';
      extracted   = options.existingExtracted as unknown as Record<string, unknown>;
      article     = options.existingArticle;
    } else {
      if (!transcript || transcript.raw_entries.length === 0) {
        throw new Error('No transcript data found for session');
      }

      console.log(`[Pipeline ${sessionId}] Cleaning transcript...`);
      cleanedText = await cleanTranscript(transcript.raw_entries);
      await updateTranscriptCleanedText(sessionId, cleanedText);

      console.log(`[Pipeline ${sessionId}] Extracting structured data...`);
      extracted = await extractStructuredData(cleanedText, ctx);

      console.log(`[Pipeline ${sessionId}] Generating article...`);
      article = await generateArticle(extracted, cleanedText, ctx);
    }

    // Image curation (if photos were uploaded)
    let featuredImageUrl: string | null = null;
    let imagePlacements: ImagePlacement[] = [];

    if (intake.images?.length > 0) {
      console.log(`[Pipeline ${sessionId}] Curating ${intake.images.length} images...`);
      const curation = await curateImages(intake.images, article, intake.destination_country);
      featuredImageUrl = curation.featuredImageUrl;
      imagePlacements  = curation.placements;
    }

    // Build connector payload (WordPress-shaped for now; Phase F will route through connectors)
    console.log(`[Pipeline ${sessionId}] Building output payload...`);
    const payload = buildWordPressPayload(
      article,
      extracted as unknown as ExtractedData,
      intake,
      imagePlacements,
      featuredImageUrl,
    );

    console.log(`[Pipeline ${sessionId}] Saving outputs...`);
    await Promise.all([
      saveArticleDraft(sessionId, article, extracted as unknown as ExtractedData),
      saveOutputPayload(sessionId, payload, { slug: payload.slug, featuredImageUrl, imagePlacements }),
    ]);

    await updateSessionStatus(sessionId, 'completed', {
      completed_at: new Date().toISOString(),
    });

    console.log(`[Pipeline ${sessionId}] Complete!`);
  } catch (error) {
    console.error(`[Pipeline ${sessionId}] Failed:`, error);
    await updateSessionStatus(sessionId, 'failed', {
      notes: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
