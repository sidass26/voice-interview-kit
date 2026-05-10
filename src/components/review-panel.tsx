'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { marked } from 'marked';
import { Card, CardHeader, CardContent } from './ui/card';
import { Badge, statusBadgeVariant } from './ui/badge';
import { Button } from './ui/button';
import type {
  InterviewSession,
  IntakeResponse,
  ResearchSnapshot,
  Transcript,
  ArticleDraft,
  OutputPayload,
} from '@/lib/types';

// ---- Publish Modal ----
function PublishModal({
  sessionId,
  slug,
  onClose,
  onPublished,
}: {
  sessionId: string;
  slug: string | null;
  onClose: () => void;
  onPublished: (url: string) => void;
}) {
  const [platform, setPlatform] = useState<'custom' | 'wordpress'>('custom');
  const [wpConfig, setWpConfig] = useState({ apiUrl: '', username: '', appPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { platform };
      if (platform === 'wordpress') body.wordpressConfig = wpConfig;

      const res = await fetch(`/api/sessions/${sessionId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Publish failed');
      }
      const { publishUrl } = await res.json();
      onPublished(publishUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Publish Article</h3>
            <p className="text-sm text-gray-500 mt-0.5">Choose where to publish</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {/* Platform toggle */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          {(['custom', 'wordpress'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                platform === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p === 'custom' ? '🌐 Custom HTML' : '📝 WordPress'}
            </button>
          ))}
        </div>

        {platform === 'custom' && (
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium">Publish as custom article</p>
            <p className="mt-1 text-blue-600">
              Article will be live at <code className="bg-blue-100 px-1 rounded">/articles/{slug ?? '[slug]'}</code>
            </p>
          </div>
        )}

        {platform === 'wordpress' && (
          <div className="space-y-3">
            <input
              type="url"
              placeholder="https://yoursite.com"
              value={wpConfig.apiUrl}
              onChange={(e) => setWpConfig((p) => ({ ...p, apiUrl: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Username"
              value={wpConfig.username}
              onChange={(e) => setWpConfig((p) => ({ ...p, username: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="Application password"
              value={wpConfig.appPassword}
              onChange={(e) => setWpConfig((p) => ({ ...p, appPassword: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400">
              Generate an application password in WordPress → Users → Profile → Application Passwords.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-shrink-0">Cancel</Button>
          <Button
            className="flex-1"
            onClick={handlePublish}
            disabled={loading || (platform === 'wordpress' && (!wpConfig.apiUrl || !wpConfig.username || !wpConfig.appPassword))}
          >
            {loading ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ReviewPanelProps {
  sessionId: string;
}

interface SessionData {
  session: InterviewSession;
  intake: IntakeResponse | null;
  research: ResearchSnapshot | null;
  transcript: Transcript | null;
  article: ArticleDraft | null;
  payload: OutputPayload | null;
}

type Tab = 'overview' | 'transcript' | 'research' | 'extraction' | 'article' | 'payload';

export function ReviewPanel({ sessionId }: ReviewPanelProps) {
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((d: SessionData) => {
        setData(d);
        if (d.session.status === 'completed' && d.article) {
          setActiveTab('article');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading session data...</div>;
  }

  if (!data) {
    return <div className="text-center py-12 text-red-500">Failed to load session data</div>;
  }

  const tabs: Array<{ id: Tab; label: string; available: boolean }> = [
    { id: 'overview', label: 'Overview', available: true },
    { id: 'transcript', label: 'Transcript', available: !!data.transcript },
    { id: 'research', label: 'Research', available: !!data.research },
    { id: 'extraction', label: 'Extracted Data', available: !!data.article?.extraction_data },
    { id: 'article', label: 'Article Draft', available: !!data.article },
    { id: 'payload', label: 'WP Payload', available: !!data.payload },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Session Review</h1>
          <Badge variant={statusBadgeVariant(data.session.status)}>
            {data.session.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {data.session.status === 'completed' && data.payload && (
            <>
              {publishedUrl ? (
                <a
                  href={publishedUrl}
                  target={publishedUrl.startsWith('http') ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg font-medium hover:bg-green-100"
                >
                  ✓ Published — View Article →
                </a>
              ) : (
                <Button size="sm" onClick={() => setShowPublishModal(true)}>
                  Publish Article
                </Button>
              )}
              <a
                href={`/sessions/${sessionId}/upload-photos`}
                className="text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
              >
                {data.intake?.images?.length ? '📸 Update Photos' : '📸 Add Photos'}
              </a>
            </>
          )}
          <Button variant="ghost" onClick={() => window.history.back()}>
            Back
          </Button>
        </div>
      </div>

      {showPublishModal && (
        <PublishModal
          sessionId={sessionId}
          slug={data.payload?.slug ?? data.payload?.payload?.slug ?? null}
          onClose={() => setShowPublishModal(false)}
          onPublished={(url) => {
            setPublishedUrl(url);
            setShowPublishModal(false);
          }}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.available && setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : tab.available
                ? 'border-transparent text-gray-500 hover:text-gray-700'
                : 'border-transparent text-gray-300 cursor-not-allowed'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'transcript' && <TranscriptTab transcript={data.transcript} />}
      {activeTab === 'research' && <ResearchTab research={data.research} />}
      {activeTab === 'extraction' && <ExtractionTab article={data.article} />}
      {activeTab === 'article' && <ArticleTab article={data.article} sessionId={sessionId} />}
      {activeTab === 'payload' && <PayloadTab payload={data.payload} />}
    </div>
  );
}

function OverviewTab({ data }: { data: SessionData }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader><h3 className="font-medium">Session Info</h3></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-gray-500">Status:</span> {data.session.status}</div>
          <div><span className="text-gray-500">Created:</span> {new Date(data.session.created_at).toLocaleString()}</div>
          {data.session.duration_seconds && (
            <div><span className="text-gray-500">Duration:</span> {Math.round(data.session.duration_seconds / 60)} min</div>
          )}
        </CardContent>
      </Card>

      {data.intake && (
        <Card>
          <CardHeader><h3 className="font-medium">Intake Data</h3></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-gray-500">Name:</span> {data.intake.employee_name}</div>
            <div><span className="text-gray-500">Destination:</span> {data.intake.destination_country}</div>
            <div><span className="text-gray-500">Cities:</span> {data.intake.destination_cities.join(', ')}</div>
            <div><span className="text-gray-500">Trip:</span> {data.intake.trip_type}</div>
            <div><span className="text-gray-500">Purpose:</span> {data.intake.trip_purpose}</div>
            <div><span className="text-gray-500">Travelers:</span> {data.intake.num_travelers}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TranscriptTab({ transcript }: { transcript: Transcript | null }) {
  if (!transcript) return null;

  return (
    <div className="space-y-4">
      {transcript.cleaned_text && (
        <Card>
          <CardHeader><h3 className="font-medium">Cleaned Transcript</h3></CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
              {transcript.cleaned_text}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><h3 className="font-medium">Raw Entries ({transcript.raw_entries.length})</h3></CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-y-auto">
          {transcript.raw_entries.map((entry, i) => (
            <div key={i} className={`text-sm ${entry.role === 'interviewer' ? 'text-blue-800' : 'text-gray-800'}`}>
              <span className="font-medium text-xs text-gray-400 mr-2">
                {Math.round(entry.timestamp)}s
              </span>
              <span className="font-medium">
                {entry.role === 'interviewer' ? 'Bot' : 'Interviewee'}:
              </span>{' '}
              {entry.text}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ResearchTab({ research }: { research: ResearchSnapshot | null }) {
  if (!research) return null;

  return (
    <Card>
      <CardHeader><h3 className="font-medium">Destination Research</h3></CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded-lg overflow-auto max-h-[600px]">
          {JSON.stringify(research.research_data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

function ExtractionTab({ article }: { article: ArticleDraft | null }) {
  if (!article?.extraction_data) return null;

  return (
    <Card>
      <CardHeader><h3 className="font-medium">Extracted Structured Data</h3></CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded-lg overflow-auto max-h-[600px]">
          {JSON.stringify(article.extraction_data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

function toHtml(content: string): string {
  // Content may be Markdown or already HTML
  if (content.trimStart().startsWith('<')) return content;
  return marked(content) as string;
}

function ArticleTab({ article, sessionId }: { article: ArticleDraft | null; sessionId: string }) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const htmlContent = article?.content ? toHtml(article.content) : '';

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Image],
    content: htmlContent,
    editorProps: {
      attributes: { class: 'tiptap-editor outline-none' },
    },
  });

  // Sync content when article changes
  useEffect(() => {
    if (editor && article?.content && !editMode) {
      editor.commands.setContent(toHtml(article.content));
    }
  }, [article?.content, editor, editMode]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    setSavedMsg('');
    try {
      const res = await fetch(`/api/sessions/${sessionId}/article`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor.getHTML() }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedMsg('Saved');
      setEditMode(false);
    } catch {
      setSavedMsg('Error saving');
    } finally {
      setSaving(false);
    }
  }, [editor, sessionId]);

  if (!article) return null;

  return (
    <>
      <style>{`
        .tiptap-editor { min-height: 400px; font-size: 15px; line-height: 1.7; color: var(--foreground); }
        .tiptap-editor h1 { font-size: 1.6rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
        .tiptap-editor h2 { font-size: 1.3rem; font-weight: 600; margin: 1.5rem 0 0.5rem; }
        .tiptap-editor h3 { font-size: 1.1rem; font-weight: 600; margin: 1rem 0 0.4rem; }
        .tiptap-editor p { margin: 0 0 0.9rem; }
        .tiptap-editor ul, .tiptap-editor ol { margin: 0.5rem 0 0.9rem 1.5rem; }
        .tiptap-editor li { margin-bottom: 0.3rem; }
        .tiptap-editor strong { font-weight: 600; }
        .tiptap-editor em { font-style: italic; }
        .tiptap-editor blockquote { border-left: 3px solid #6B2AEA; padding-left: 1rem; margin: 1rem 0; opacity: 0.85; }
        .tiptap-editor img { max-width: 100%; border-radius: 4px; margin: 1rem 0; }
        .tiptap-editor [contenteditable] { outline: none; }
        .tiptap-toolbar button { padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 500; transition: background 0.1s; }
        .tiptap-toolbar button:hover { background: var(--muted); }
        .tiptap-toolbar button.active { background: var(--muted); color: #6B2AEA; }
      `}</style>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Article Draft (v{article.version})</h3>
            <div className="flex items-center gap-2">
              {savedMsg && (
                <span className={`text-xs ${savedMsg === 'Saved' ? 'text-green-600' : 'text-red-500'}`}>
                  {savedMsg}
                </span>
              )}
              {editMode ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => { setEditMode(false); editor?.commands.setContent(article.content); }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(editor?.getHTML() ?? article.content)}>
                    Copy HTML
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditMode(true)}>
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>
          {editMode && editor && (
            <div className="tiptap-toolbar flex flex-wrap gap-1 pt-3 border-t mt-3">
              {[
                { label: 'B', title: 'Bold', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
                { label: 'I', title: 'Italic', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
                { label: 'H2', title: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
                { label: 'H3', title: 'Heading 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
                { label: '• List', title: 'Bullet list', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
                { label: '1. List', title: 'Ordered list', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
                { label: '"', title: 'Blockquote', action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
              ].map(({ label, title, action, active }) => (
                <button key={label} title={title} onClick={action} className={active ? 'active' : ''}>{label}</button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="border rounded-lg p-4" style={{ borderColor: 'var(--border)' }}>
              <EditorContent editor={editor} />
            </div>
          ) : (
            <div
              className="tiptap-editor prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: editor?.getHTML() ?? htmlContent }}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PayloadTab({ payload }: { payload: OutputPayload | null }) {
  if (!payload) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-medium">WordPress Payload Preview</h3>
        <p className="text-xs text-gray-500 mt-1">This is stored but not sent anywhere yet.</p>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded-lg overflow-auto max-h-[600px]">
          {JSON.stringify(payload.payload, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
