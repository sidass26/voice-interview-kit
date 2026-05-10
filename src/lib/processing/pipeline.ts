import {
  getIntake,
  getTranscript,
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

export interface PipelineOptions {
  // Skip to a later step (used when re-running after image upload on a completed session)
  skipTo?: 'image_curation';
  // Pre-supply already-extracted data when skipping early steps
  existingArticle?: string;
  existingExtracted?: import('../types').ExtractedData;
}

export async function runProcessingPipeline(
  sessionId: string,
  options: PipelineOptions = {}
): Promise<void> {
  try {
    await updateSessionStatus(sessionId, 'processing');

    const [intake, transcript] = await Promise.all([
      getIntake(sessionId),
      getTranscript(sessionId),
    ]);

    if (!intake) throw new Error('No intake data found for session');

    let cleanedText: string;
    let extracted: import('../types').ExtractedData;
    let article: string;

    if (options.skipTo === 'image_curation') {
      // Resume from image curation — reuse already-generated article + extraction
      if (!options.existingArticle || !options.existingExtracted) {
        throw new Error('existingArticle and existingExtracted required when skipTo=image_curation');
      }
      cleanedText = transcript?.cleaned_text ?? '';
      extracted = options.existingExtracted;
      article = options.existingArticle;
    } else {
      if (!transcript || transcript.raw_entries.length === 0) {
        throw new Error('No transcript data found for session');
      }

      // Step 1: Clean transcript
      console.log(`[Pipeline ${sessionId}] Cleaning transcript...`);
      cleanedText = await cleanTranscript(transcript.raw_entries);
      await updateTranscriptCleanedText(sessionId, cleanedText);

      // Step 2: Extract structured data
      console.log(`[Pipeline ${sessionId}] Extracting structured data...`);
      extracted = await extractStructuredData(
        cleanedText,
        intake.destination_country,
        intake.destination_cities
      );

      // Step 3: Generate article
      console.log(`[Pipeline ${sessionId}] Generating article...`);
      article = await generateArticle(extracted, cleanedText, intake);
    }

    // Step 3.5: Curate images (if any uploaded)
    let featuredImageUrl: string | null = null;
    let imagePlacements: import('../types').ImagePlacement[] = [];

    if (intake.images && intake.images.length > 0) {
      console.log(`[Pipeline ${sessionId}] Curating ${intake.images.length} images...`);
      const curation = await curateImages(
        intake.images,
        article,
        intake.destination_country
      );
      featuredImageUrl = curation.featuredImageUrl;
      imagePlacements = curation.placements;
    }

    // Step 4: Build WordPress payload
    console.log(`[Pipeline ${sessionId}] Building WordPress payload...`);
    const payload = buildWordPressPayload(
      article,
      extracted,
      intake,
      imagePlacements,
      featuredImageUrl
    );

    // Step 5: Store everything
    console.log(`[Pipeline ${sessionId}] Saving outputs...`);
    await Promise.all([
      saveArticleDraft(sessionId, article, extracted),
      saveOutputPayload(sessionId, payload, {
        slug: payload.slug,
        featuredImageUrl,
        imagePlacements,
      }),
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
