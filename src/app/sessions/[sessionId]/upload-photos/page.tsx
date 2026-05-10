'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { TripImage, ItineraryDay } from '@/lib/types';

interface UploadedImage extends TripImage {
  localPreview: string;
  uploading?: boolean;
}

export default function UploadPhotosPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([]);
  const [existingImages, setExistingImages] = useState<TripImage[]>([]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        setDestination(data.intake?.destination_country ?? '');
        setItinerary(data.intake?.itinerary ?? []);
        const existing: TripImage[] = data.intake?.images ?? [];
        setExistingImages(existing);
        // Show existing images pre-populated
        setImages(
          existing.map((img) => ({
            ...img,
            localPreview: img.url,
          }))
        );
      })
      .catch(() => setError('Failed to load session'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const slots = 10 - images.length;
    const toUpload = files.slice(0, slots);

    const newImages: UploadedImage[] = toUpload.map((file) => ({
      url: '',
      storagePath: '',
      description: '',
      localPreview: URL.createObjectURL(file),
      uploading: true,
    }));

    const startIndex = images.length;
    setImages((prev) => [...prev, ...newImages]);

    await Promise.all(
      toUpload.map(async (file, i) => {
        try {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('type', 'trip');
          fd.append('sessionId', sessionId);

          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          if (!res.ok) throw new Error('Upload failed');
          const { url, storagePath } = await res.json();

          setImages((prev) => {
            const updated = [...prev];
            updated[startIndex + i] = { ...updated[startIndex + i], url, storagePath, uploading: false };
            return updated;
          });
        } catch {
          setImages((prev) => {
            const updated = [...prev];
            updated[startIndex + i] = { ...updated[startIndex + i], uploading: false };
            return updated;
          });
        }
      })
    );

    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const updateDescription = (index: number, description: string) =>
    setImages((prev) => {
      const u = [...prev];
      u[index] = { ...u[index], description };
      return u;
    });

  const updateDay = (index: number, day: number | undefined) =>
    setImages((prev) => {
      const u = [...prev];
      u[index] = { ...u[index], day };
      return u;
    });

  const removeImage = (index: number) =>
    setImages((prev) => {
      const old = prev[index];
      if (old.localPreview !== old.url) URL.revokeObjectURL(old.localPreview);
      return prev.filter((_, i) => i !== index);
    });

  const handleSaveAndRegenerate = async () => {
    setSaving(true);
    setError(null);

    try {
      const readyImages: TripImage[] = images
        .filter((img) => img.url && img.description.trim())
        .map(({ url, storagePath, description, day }) => ({ url, storagePath, description, day }));

      // Save images to intake
      const saveRes = await fetch(`/api/sessions/${sessionId}/images`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: readyImages }),
      });
      if (!saveRes.ok) throw new Error('Failed to save images');

      // Re-trigger pipeline (image curation + article rebuild)
      const processRes = await fetch(`/api/sessions/${sessionId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipTo: 'image_curation' }),
      });
      if (!processRes.ok) throw new Error('Failed to start processing');

      router.push(`/review/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading session…</div>
      </div>
    );
  }

  const completedCount = images.filter((img) => img.url && !img.uploading).length;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm text-blue-600 font-medium uppercase tracking-wide mb-1">
            Add photos · {destination}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Upload trip photos</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI will select the best cover image and place others contextually in your article.
            Each photo needs a short description so the AI knows where it fits.
          </p>
        </div>

        {existingImages.length > 0 && images.length === existingImages.length && (
          <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-700">
            You already have {existingImages.length} photo{existingImages.length > 1 ? 's' : ''} saved. Add more or update descriptions below.
          </div>
        )}

        {/* Upload area */}
        {images.length < 10 && (
          <div
            onClick={() => photoInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-sm font-medium text-gray-700">Click to add photos</p>
            <p className="text-xs text-gray-400 mt-1">Up to {10 - images.length} more · JPG, PNG, HEIC</p>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>
        )}

        {/* Photo cards */}
        {images.map((img, i) => (
          <div key={i} className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 relative">
              <img src={img.localPreview} alt="" className="w-full h-full object-cover" />
              {img.uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-xs">Uploading…</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <textarea
                placeholder="Describe this photo — what's in it, where it was taken, why it's meaningful"
                value={img.description}
                onChange={(e) => updateDescription(i, e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              <select
                value={img.day ?? ''}
                onChange={(e) => updateDay(i, e.target.value ? parseInt(e.target.value) : undefined)}
                className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-600"
              >
                <option value="">Tag to a day (optional)</option>
                {itinerary.map((d) => (
                  <option key={d.day} value={d.day}>
                    Day {d.day}{d.city ? ` — ${d.city}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => removeImage(i)}
              className="text-gray-300 hover:text-red-500 text-xl leading-none"
            >
              ×
            </button>
          </div>
        ))}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/review/${sessionId}`)}
            className="flex-shrink-0 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAndRegenerate}
            disabled={saving || completedCount === 0}
            className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving
              ? 'Saving & regenerating article…'
              : `Save ${completedCount} photo${completedCount !== 1 ? 's' : ''} & Regenerate Article`}
          </button>
        </div>

        <p className="text-xs text-center text-gray-400">
          This will re-run the article generation with your photos. It takes ~30 seconds.
        </p>
      </div>
    </div>
  );
}
