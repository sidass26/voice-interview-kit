import type { WordPressPayload, WordPressConfig } from '../types';

export interface WPPublishResult {
  postId: number;
  postUrl: string;
}

export async function publishToWordPress(
  payload: WordPressPayload,
  config: WordPressConfig,
  featuredImageUrl: string | null
): Promise<WPPublishResult> {
  const base = config.apiUrl.replace(/\/$/, '');
  const auth = Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  // Upload featured image if present
  let featuredMediaId: number | undefined;
  if (featuredImageUrl) {
    featuredMediaId = await uploadFeaturedImage(featuredImageUrl, payload.title, base, auth);
  }

  // Resolve or create categories
  const categoryIds = await resolveTerms(base, headers, 'categories', payload.categories);

  // Resolve or create tags
  const tagIds = await resolveTerms(base, headers, 'tags', payload.tags);

  // Create the post
  const postBody: Record<string, unknown> = {
    title: payload.title,
    slug: payload.slug,
    content: payload.content,
    excerpt: payload.excerpt,
    status: 'draft', // always draft — manual review before publishing
    categories: categoryIds,
    tags: tagIds,
    meta: payload.meta,
  };

  if (featuredMediaId) {
    postBody.featured_media = featuredMediaId;
  }

  const postRes = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(postBody),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    throw new Error(`WordPress post creation failed: ${postRes.status} — ${errText}`);
  }

  const post = await postRes.json();
  return { postId: post.id, postUrl: post.link };
}

async function uploadFeaturedImage(
  imageUrl: string,
  title: string,
  base: string,
  auth: string
): Promise<number | undefined> {
  try {
    // Download the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return undefined;

    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();
    const filename = `${title.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}.jpg`;

    const uploadRes = await fetch(`${base}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': contentType,
      },
      body: buffer,
    });

    if (!uploadRes.ok) return undefined;
    const media = await uploadRes.json();
    return media.id;
  } catch {
    return undefined;
  }
}

async function resolveTerms(
  base: string,
  headers: Record<string, string>,
  taxonomy: 'categories' | 'tags',
  names: string[]
): Promise<number[]> {
  const endpoint = taxonomy === 'categories'
    ? `${base}/wp-json/wp/v2/categories`
    : `${base}/wp-json/wp/v2/tags`;

  const ids: number[] = [];

  for (const name of names) {
    if (!name.trim()) continue;
    try {
      // Search for existing term
      const searchRes = await fetch(`${endpoint}?search=${encodeURIComponent(name)}&per_page=5`, { headers });
      if (searchRes.ok) {
        const terms = await searchRes.json();
        const existing = terms.find(
          (t: { name: string }) => t.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) {
          ids.push(existing.id);
          continue;
        }
      }

      // Create if not found
      const createRes = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
      });
      if (createRes.ok) {
        const term = await createRes.json();
        ids.push(term.id);
      }
    } catch {
      // Non-fatal — skip this term
    }
  }

  return ids;
}
