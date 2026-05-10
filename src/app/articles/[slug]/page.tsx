import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { WordPressPayload, ImagePlacement } from '@/lib/types';
import { getPayloadBySlug, getAuthorProfile } from '@/lib/orchestration/session-manager';
import { createServerClient } from '@/lib/supabase/server';

interface ArticleData {
  payload: WordPressPayload;
  featured_image_url: string | null;
  image_placements: ImagePlacement[];
  published_at: string | null;
  slug: string | null;
  author: {
    name: string;
    role: string | null;
    bio: string | null;
    photo_url: string | null;
    twitter: string | null;
    instagram: string | null;
    linkedin: string | null;
  } | null;
  intake: {
    destination_country: string;
    destination_cities: string[];
    trip_purpose: string;
    trip_duration_days: number;
  } | null;
}

async function getArticle(slug: string): Promise<ArticleData | null> {
  const outputPayload = await getPayloadBySlug(slug);
  if (!outputPayload) return null;

  const supabase = createServerClient();
  const { data: intake } = await supabase
    .from('intake_responses')
    .select()
    .eq('session_id', outputPayload.session_id)
    .single();

  const author = intake?.work_email ? await getAuthorProfile(intake.work_email) : null;

  return {
    payload: outputPayload.payload,
    featured_image_url: outputPayload.featured_image_url ?? null,
    image_placements: outputPayload.image_placements ?? [],
    published_at: outputPayload.published_at ?? null,
    slug: outputPayload.slug ?? null,
    author: author
      ? {
          name: author.employee_name,
          role: author.role ?? null,
          bio: author.bio ?? null,
          photo_url: author.photo_url ?? null,
          twitter: author.twitter ?? null,
          instagram: author.instagram ?? null,
          linkedin: author.linkedin ?? null,
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
  };
}

function readingTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const data = await getArticle(slug);
  if (!data) return {};
  return {
    title: data.payload.title,
    description: data.payload.excerpt,
    authors: data.author ? [{ name: data.author.name }] : undefined,
    openGraph: {
      title: data.payload.title,
      description: data.payload.excerpt ?? undefined,
      images: data.featured_image_url ? [data.featured_image_url] : [],
      type: 'article',
      publishedTime: data.published_at ?? undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: data.payload.title,
      description: data.payload.excerpt ?? undefined,
      images: data.featured_image_url ? [data.featured_image_url] : [],
    },
  };
}

export default async function ArticlePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await getArticle(slug);
  if (!data) notFound();

  const { payload, featured_image_url, published_at, author, intake } = data;
  const mins = readingTime(payload.content);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: payload.title,
    description: payload.excerpt,
    image: featured_image_url ?? undefined,
    datePublished: published_at ?? new Date().toISOString(),
    dateModified: published_at ?? new Date().toISOString(),
    author: author
      ? { '@type': 'Person', name: author.name, jobTitle: author.role ?? undefined }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: '[Company]',
      url: '#',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`
        .article-body { color: #c3c3cc; font-size: 17px; line-height: 1.8; }
        .article-body h1 { display: none; }
        .article-body h2 { color: #ededf3; font-size: 1.5rem; font-weight: 300; line-height: 1.25; letter-spacing: -0.01em; margin: 3rem 0 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .article-body h3 { color: #ededf3; font-size: 1.2rem; font-weight: 400; margin: 2rem 0 0.75rem; }
        .article-body p { margin: 0 0 1.4rem; }
        .article-body a { color: #A78BFA; text-decoration: none; }
        .article-body a:hover { text-decoration: underline; }
        .article-body strong { color: #ededf3; font-weight: 600; }
        .article-body ul, .article-body ol { margin: 1rem 0 1.4rem 1.5rem; }
        .article-body li { margin-bottom: 0.4rem; }
        .article-body blockquote { border-left: 3px solid #6B2AEA; margin: 1.5rem 0; padding: 0.5rem 0 0.5rem 1.5rem; color: #ededf3; font-style: normal; }
        .article-body figure { margin: 2.5rem 0; }
        .article-body img { width: 100%; object-fit: cover; display: block; }
        .article-body figcaption { text-align: center; font-size: 0.8rem; color: #70707d; margin-top: 0.5rem; padding: 0 1rem; }
        .article-body hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 2.5rem 0; }
      `}</style>

      <div className="min-h-screen" style={{ background: '#0B0F1A', color: '#ededf3' }}>

        {/* Nav */}
        <nav style={{ background: 'rgba(11,15,26,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md h-14 flex items-center justify-between px-6 md:px-12">
          <a href="/stories" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: '#6B2AEA' }}>H</div>
            <span className="text-sm font-semibold" style={{ color: '#ededf3' }}>Employee Stories</span>
          </a>
          <a href="/stories" className="text-sm hover:text-white transition-colors"
            style={{ color: '#c3c3cc' }}>
            ← All stories
          </a>
        </nav>

        {/* Hero */}
        <div className="relative pt-14" style={{ height: '72vh', minHeight: 480 }}>
          {featured_image_url ? (
            <img src={featured_image_url} alt={payload.title}
              className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #0d1117 50%, #0f0a1e 100%)' }} />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(11,15,26,1) 0%, rgba(11,15,26,0.6) 40%, rgba(11,15,26,0.1) 100%)' }} />

          {/* Hero content */}
          <div className="absolute bottom-0 left-0 right-0 px-6 md:px-16 pb-12 max-w-[1200px] mx-auto w-full">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs mb-5" style={{ color: 'rgba(237,237,243,0.45)' }}>
              <a href="/" className="hover:text-white transition-colors">Home</a>
              <span>/</span>
              <a href="/stories" className="hover:text-white transition-colors">Stories</a>
              <span>/</span>
              <span style={{ color: 'rgba(237,237,243,0.7)' }}>{intake?.destination_country}</span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="text-xs font-semibold px-3 py-1 rounded-full text-white"
                style={{ background: '#6B2AEA' }}>Employee Story</span>
              {intake?.trip_duration_days && (
                <span className="text-xs px-3 py-1 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(237,237,243,0.7)' }}>
                  {intake.trip_duration_days} days
                </span>
              )}
              {payload.meta?.travel_month && (
                <span className="text-xs px-3 py-1 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(237,237,243,0.7)' }}>
                  {payload.meta.travel_month}
                </span>
              )}
              {intake?.trip_purpose && (
                <span className="text-xs px-3 py-1 rounded-full capitalize" style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(237,237,243,0.7)' }}>
                  {intake.trip_purpose}
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-[56px] leading-[1.1] font-light mb-5 max-w-3xl tracking-tight"
              style={{ color: '#ededf3', letterSpacing: '-0.01em' }}>
              {payload.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm" style={{ color: 'rgba(237,237,243,0.55)' }}>
              {author && <span style={{ color: '#ededf3', fontWeight: 500 }}>{author.name}</span>}
              {author && <span>·</span>}
              <span>{intake?.destination_cities?.join(', ') ?? intake?.destination_country}</span>
              <span>·</span>
              <span>{mins} min read</span>
              {published_at && <><span>·</span><span>{formatDate(published_at)}</span></>}
            </div>
          </div>
        </div>

        {/* Author strip */}
        {author && (
          <div style={{ background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            className="px-6 md:px-16 py-6">
            <div className="max-w-[1200px] mx-auto flex items-start gap-4">
              {author.photo_url ? (
                <img src={author.photo_url} alt={author.name}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                  style={{ border: '2px solid rgba(107,42,234,0.4)' }} />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: '#6B2AEA' }}>
                  {author.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
                  <span className="font-semibold" style={{ color: '#ededf3' }}>{author.name}</span>
                  {author.role && (
                    <span className="text-sm" style={{ color: '#A78BFA' }}>{author.role}</span>
                  )}
                </div>
                {author.bio && (
                  <p className="text-sm leading-relaxed max-w-xl" style={{ color: '#c3c3cc' }}>{author.bio}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {author.twitter && (
                    <a href={`https://twitter.com/${author.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1 rounded-full transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#c3c3cc' }}>
                      𝕏 {author.twitter}
                    </a>
                  )}
                  {author.instagram && (
                    <a href={`https://instagram.com/${author.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1 rounded-full transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#c3c3cc' }}>
                      IG {author.instagram}
                    </a>
                  )}
                  {author.linkedin && (
                    <a href={author.linkedin.startsWith('http') ? author.linkedin : `https://${author.linkedin}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1 rounded-full transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#c3c3cc' }}>
                      in LinkedIn
                    </a>
                  )}
                  <span className="text-xs px-3 py-1 rounded-full font-medium"
                    style={{ border: '1px solid rgba(107,42,234,0.4)', color: '#A78BFA', background: 'rgba(107,42,234,0.08)' }}>
                    ✓ First-hand experience
                  </span>
                </div>
              </div>
              {published_at && (
                <div className="flex-shrink-0 text-right hidden md:block">
                  <div className="text-xs" style={{ color: '#70707d' }}>Published</div>
                  <div className="text-sm font-medium mt-0.5" style={{ color: '#c3c3cc' }}>{formatDate(published_at)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Article layout */}
        <div className="max-w-[1200px] mx-auto px-6 md:px-16 py-12 md:grid md:gap-16" style={{ gridTemplateColumns: '1fr 300px' }}>

          {/* Article body */}
          <main>
            {/* Lede */}
            <p className="text-xl md:text-2xl font-light leading-relaxed mb-10 pb-10 italic"
              style={{ color: '#c3c3cc', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {payload.excerpt}
            </p>

            {/* Content */}
            <div className="article-body" dangerouslySetInnerHTML={{ __html: payload.content }} />
          </main>

          {/* Sidebar */}
          <aside className="hidden md:block">
            <div className="sticky top-20 space-y-px">

              {/* Trip at a glance */}
              <div style={{ background: '#111827', borderTop: '2px solid #6B2AEA' }} className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#6B2AEA' }}>
                  Trip at a glance
                </p>
                <div className="space-y-0">
                  {([
                    ['Destination', intake?.destination_country],
                    ['Cities', intake?.destination_cities?.join(', ')],
                    ['Duration', payload.meta?.trip_duration],
                    ['Travel month', payload.meta?.travel_month],
                    ['Purpose', intake?.trip_purpose],
                    ['Budget', payload.meta?.budget_total || null],
                  ] as [string, string | undefined | null][])
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label} className="flex justify-between items-start py-3"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-xs" style={{ color: '#70707d' }}>{label}</span>
                        <span className="text-xs font-semibold text-right max-w-[140px]" style={{ color: '#ededf3' }}>
                          {value}
                        </span>
                      </div>
                    ))}
                </div>
                <a
                  href={`/stories`}
                  className="block mt-6 text-center text-sm font-semibold py-3 px-5 rounded-full text-white transition-opacity hover:opacity-90"
                  style={{ background: '#6B2AEA' }}>
                  Explore more stories →
                </a>
              </div>

              {/* Tags */}
              {payload.tags?.length > 0 && (
                <div style={{ background: '#111827' }} className="p-6">
                  <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#70707d' }}>
                    Topics
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {payload.tags.map((tag) => (
                      <span key={tag} className="text-xs px-3 py-1 rounded-full"
                        style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#c3c3cc' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </aside>
        </div>

        {/* Footer CTA */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0B0F1A' }}
          className="px-6 text-center py-20">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#6B2AEA' }}>
            More from our team
          </p>
          <h2 className="text-3xl md:text-4xl font-light mb-4 tracking-tight" style={{ color: '#ededf3' }}>
            Explore more employee stories
          </h2>
          <p className="text-base mb-8 max-w-md mx-auto" style={{ color: '#c3c3cc' }}>
            Real trips, honest takes — from the people building the future of travel.
          </p>
          <a href="/stories"
            className="inline-block text-sm font-semibold px-8 py-4 rounded-full text-white transition-opacity hover:opacity-90"
            style={{ background: '#6B2AEA' }}>
            View all destinations →
          </a>
        </div>

      </div>
    </>
  );
}
