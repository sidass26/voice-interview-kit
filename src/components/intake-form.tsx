'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Card, CardHeader, CardContent } from './ui/card';
import { ConfigField, isFilled } from './config-field';
import type { FieldDefinition, RepeatingSection } from '@/lib/config/types';
import type { TripImage } from '@/lib/types';

/**
 * The serializable slice of InterviewConfig this form needs. Assembled in the
 * `/intake` server component so prompt builders stay out of the client bundle.
 */
export interface IntakeFormConfig {
  fields: FieldDefinition[];
  repeatingSection: RepeatingSection | null;
  profileFields: FieldDefinition[];
  subjectLabel: string;
}

interface UploadedImage extends TripImage {
  localPreview: string;
  uploading?: boolean;
  progress?: number; // 0–100
}

type StepKey = 'basics' | 'repeating' | 'profile' | 'photos';

/** Seed a form state object from field definitions. */
function seedState(fields: FieldDefinition[]): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((f) => [f.id, f.type === 'number' ? (f.min ?? 1) : ''])
  );
}

export function IntakeForm({ config }: { config: IntakeFormConfig }) {
  const router = useRouter();
  const { fields, repeatingSection, profileFields } = config;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const [form, setForm] = useState<Record<string, unknown>>(() => seedState(fields));
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown>>(() => seedState(profileFields));
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoStoragePath, setPhotoStoragePath] = useState<string | null>(null);
  const [authorPhotoUploading, setAuthorPhotoUploading] = useState(false);
  const authorPhotoRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<UploadedImage[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // The wizard skips the repeating step entirely when no section is configured,
  // so indices and the progress bar adapt without any literal step numbers.
  const steps = useMemo(() => {
    const s: Array<{ key: StepKey; label: string }> = [{ key: 'basics', label: 'Basics' }];
    if (repeatingSection) s.push({ key: 'repeating', label: repeatingSection.label });
    s.push({ key: 'profile', label: 'Your profile' });
    s.push({ key: 'photos', label: 'Photos' });
    return s;
  }, [repeatingSection]);

  const step = steps[stepIndex]?.key ?? 'basics';
  const go = (delta: number) =>
    setStepIndex((i) => Math.max(0, Math.min(i + delta, steps.length - 1)));

  // work_email is load-bearing for uploads and the author_profiles upsert.
  // context.ts hardcodes the same id; generalizing both needs a
  // `subjectEmailField` on IntakeConfig.
  const workEmail = (form.work_email as string) ?? '';

  const rowField = repeatingSection?.extractUniqueValues?.fromField;
  const uniqueValues = useMemo(() => {
    if (!rowField) return [];
    return [...new Set(rows.map((r) => (r[rowField] as string) ?? '').filter(Boolean))];
  }, [rows, rowField]);

  const update = (id: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [id]: value }));

    // Grow or shrink the repeating section when its driving field changes,
    // preserving anything already entered.
    if (repeatingSection?.rowCountFromField === id) {
      const count = Math.max(0, Math.min(Number(value) || 0, 60));
      setRows((prev) => {
        if (count <= prev.length) return prev.slice(0, count);
        const next = [...prev];
        while (next.length < count) {
          const carry = rowField ? { [rowField]: next[next.length - 1]?.[rowField] ?? '' } : {};
          next.push({ ...seedState(repeatingSection.itemFields), ...carry });
        }
        return next;
      });
    }
  };

  const updateRow = (index: number, id: string, value: string | number) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [id]: value };

      // Carry the grouping value forward into following rows that still match
      // the old value or are empty — e.g. a city persists until it changes.
      if (id === rowField && index < updated.length - 1) {
        const oldValue = prev[index]?.[id];
        for (let i = index + 1; i < updated.length; i++) {
          if (updated[i][id] === oldValue || updated[i][id] === '') {
            updated[i] = { ...updated[i], [id]: value };
          } else break;
        }
      }
      return updated;
    });
  };

  const addRow = () =>
    setRows((prev) => [...prev, seedState(repeatingSection?.itemFields ?? [])]);
  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  const handleAuthorPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workEmail) return;

    setAuthorPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'author');
      fd.append('email', workEmail);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url, storagePath } = await res.json();
      setPhotoUrl(url);
      setPhotoStoragePath(storagePath);
    } catch {
      setError('Photo upload failed — you can add it later.');
    } finally {
      setAuthorPhotoUploading(false);
    }
  };

  const uploadWithProgress = (fd: FormData, slotIndex: number): Promise<void> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 95); // cap at 95 until response
        setImages((prev) => {
          const updated = [...prev];
          updated[slotIndex] = { ...updated[slotIndex], progress: pct };
          return updated;
        });
      };

      const settle = (patch: Partial<UploadedImage>) => {
        setImages((prev) => {
          const updated = [...prev];
          updated[slotIndex] = { ...updated[slotIndex], uploading: false, ...patch };
          return updated;
        });
        resolve();
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const { url, storagePath } = JSON.parse(xhr.responseText);
            settle({ url, storagePath, progress: 100 });
            return;
          } catch {
            /* fall through to the plain failure path */
          }
        }
        settle({});
      };
      xhr.onerror = () => settle({});
      xhr.send(fd);
    });

  const handleTripPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const tempId = `temp-${workEmail.replace('@', '_')}-${Date.now()}`;
    const slots = files.slice(0, 10 - images.length);

    const startIndex = images.length;
    setImages((prev) => [
      ...prev,
      ...slots.map((file) => ({
        url: '',
        storagePath: '',
        description: '',
        localPreview: URL.createObjectURL(file),
        uploading: true,
        progress: 0,
      })),
    ]);

    await Promise.all(
      slots.map((file, i) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', 'trip');
        fd.append('sessionId', tempId);
        return uploadWithProgress(fd, startIndex + i);
      })
    );

    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const patchImage = (index: number, patch: Partial<UploadedImage>) =>
    setImages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });

  const removeImage = (index: number) =>
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].localPreview);
      return prev.filter((_, i) => i !== index);
    });

  const canLeaveBasics = fields
    .filter((f) => f.required)
    .every((f) => isFilled(f, form[f.id]));

  // Only gate on the repeating section when it actually drives context.
  const canLeaveRepeating = !rowField || uniqueValues.length > 0;

  const handleSubmit = async (skipPhotos = false) => {
    setLoading(true);
    setError(null);

    try {
      if (!canLeaveRepeating && repeatingSection) {
        const label = repeatingSection.itemFields
          .find((f) => f.id === rowField)?.label ?? 'value';
        setError(`Please enter at least one ${label.toLowerCase()}.`);
        setLoading(false);
        return;
      }

      // Author profile is fire-and-forget — a failure here must not block the
      // interview. NB: these field ids must match author_profiles columns.
      if (Object.values(profile).some(Boolean) || photoUrl) {
        fetch('/api/author-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_email: workEmail,
            employee_name: form.employee_name,
            ...profile,
            photo_url: photoUrl,
            photo_storage_path: photoStoragePath,
          }),
        }).catch(console.error);
      }

      const readyImages: TripImage[] = skipPhotos
        ? []
        : images
            .filter((img) => img.url && img.description.trim())
            .map(({ url, storagePath, description, day }) => ({
              url,
              storagePath,
              description,
              day,
            }));

      const payload: Record<string, unknown> = { ...form, images: readyImages };
      if (repeatingSection) {
        // `day` is synthesised from row order — it isn't an itemField, but
        // ItineraryDay and the photo day-picker both depend on it.
        payload[repeatingSection.id] = rows.map((r, i) => ({ ...r, day: i + 1 }));
        if (repeatingSection.extractUniqueValues) {
          payload[repeatingSection.extractUniqueValues.toContextKey] = uniqueValues;
        }
      }

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to create session');

      const { sessionId } = await response.json();
      router.push(`/interview/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const completedImagesCount = images.filter((img) => img.url && !img.uploading).length;
  const isLast = stepIndex === steps.length - 1;

  const headings: Record<StepKey, { title: string; blurb: string }> = {
    basics: { title: 'Tell us the basics', blurb: 'Quick context so we can tailor the interview.' },
    repeating: {
      title: repeatingSection?.label ?? '',
      blurb: 'This helps us walk through things in order.',
    },
    profile: {
      title: 'Your author profile',
      blurb: 'Shown on your published article for E-E-A-T credibility. You can skip and add later.',
    },
    photos: {
      title: 'Add photos',
      blurb: 'Photos appear contextually in the article. AI picks the cover. Optional.',
    },
  };

  const errorBox = error ? (
    <div className="p-3 bg-red-50 dark:bg-[rgba(239,68,68,0.1)] border border-red-200 dark:border-[rgba(239,68,68,0.3)] rounded-lg text-sm text-red-700 dark:text-red-400">
      {error}
    </div>
  ) : null;

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-[#ededf3]">
          {headings[step].title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#c3c3cc] mt-1">{headings[step].blurb}</p>

        <div className="flex items-center gap-1.5 mt-3">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                stepIndex > i
                  ? 'bg-blue-600 dark:bg-[#6B2AEA]'
                  : stepIndex === i
                    ? 'bg-blue-400 dark:bg-[#9B59E8]'
                    : 'bg-gray-200 dark:bg-[#272735]'
              }`}
            />
          ))}
        </div>
        <div className="flex gap-1.5 mt-1">
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={`flex-1 text-center text-[10px] font-medium ${
                stepIndex === i
                  ? 'text-blue-600 dark:text-[#A78BFA]'
                  : 'text-gray-400 dark:text-[#70707d]'
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {step === 'basics' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {fields.map((f) => (
                <div key={f.id} className={f.type === 'textarea' ? 'col-span-2' : undefined}>
                  <ConfigField
                    def={f}
                    value={form[f.id]}
                    onChange={(v) => update(f.id, v)}
                  />
                </div>
              ))}
            </div>
            {errorBox}
            <Button size="lg" className="w-full" onClick={() => go(1)} disabled={!canLeaveBasics}>
              Next — {steps[1].label}
            </Button>
          </div>
        )}

        {step === 'repeating' && repeatingSection && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-[#c3c3cc] bg-gray-50 dark:bg-[#272735] rounded-lg px-4 py-2">
              <span>
                {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
                {uniqueValues.length > 0 && ` · ${uniqueValues.join(', ')}`}
              </span>
              <button
                onClick={() => go(-1)}
                className="text-blue-600 dark:text-[#A78BFA] hover:underline"
              >
                Edit basics
              </button>
            </div>

            {rowField && rows.length > 3 && (
              <div className="text-xs text-gray-400 dark:text-[#70707d] bg-gray-50 dark:bg-[#1e1e2a] rounded px-3 py-2">
                Tip: the value carries forward from the previous row — change it when it changes.
              </div>
            )}

            <div className="space-y-2">
              {rows.map((row, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 hover:border-gray-300 dark:hover:border-[rgba(107,42,234,0.3)] transition-colors"
                >
                  <div className="flex-shrink-0 w-12 pt-7">
                    <span className="text-sm font-medium text-gray-500 dark:text-[#70707d]">
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    {repeatingSection.itemFields.map((f) => (
                      <ConfigField
                        key={f.id}
                        def={f}
                        idPrefix={`row${i}_`}
                        value={row[f.id]}
                        onChange={(v) => updateRow(i, f.id, v)}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => removeRow(i)}
                    aria-label={`Remove entry ${i + 1}`}
                    className="text-gray-400 dark:text-[#70707d] hover:text-red-500 text-lg leading-none flex-shrink-0 mt-7"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addRow}
              className="text-sm text-blue-600 dark:text-[#A78BFA] hover:underline"
            >
              + {repeatingSection.addButtonLabel}
            </button>

            {errorBox}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => go(-1)} className="flex-shrink-0">
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={() => go(1)}
                disabled={!canLeaveRepeating}
              >
                Next — {steps[stepIndex + 1]?.label}
              </Button>
            </div>
          </div>
        )}

        {step === 'profile' && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div
                className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 dark:border-[rgba(255,255,255,0.15)] flex items-center justify-center cursor-pointer hover:border-blue-400 dark:hover:border-[#6B2AEA] transition-colors flex-shrink-0 overflow-hidden bg-gray-50 dark:bg-[#272735]"
                onClick={() => authorPhotoRef.current?.click()}
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Author" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400 dark:text-[#70707d]">
                    {authorPhotoUploading ? 'Uploading…' : 'Photo'}
                  </span>
                )}
              </div>
              <input
                ref={authorPhotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAuthorPhotoSelect}
                disabled={!workEmail}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-[#c3c3cc]">
                  Profile photo
                </p>
                <p className="text-xs text-gray-500 dark:text-[#70707d] mt-0.5">
                  Shown in the author box on your article. Builds reader trust.
                </p>
                <button
                  onClick={() => authorPhotoRef.current?.click()}
                  disabled={!workEmail || authorPhotoUploading}
                  className="mt-2 text-xs text-blue-600 dark:text-[#A78BFA] hover:underline disabled:text-gray-400 dark:disabled:text-[#70707d]"
                >
                  {photoUrl ? 'Change photo' : 'Upload photo'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {profileFields.map((f) => (
                <div key={f.id} className={f.type === 'textarea' ? 'col-span-2' : undefined}>
                  <ConfigField
                    def={f}
                    idPrefix="profile_"
                    value={profile[f.id]}
                    onChange={(v) => setProfile((prev) => ({ ...prev, [f.id]: v }))}
                  />
                </div>
              ))}
            </div>

            {errorBox}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => go(-1)} className="flex-shrink-0">
                Back
              </Button>
              <Button size="lg" className="flex-1" onClick={() => go(1)}>
                Next — Add photos
              </Button>
            </div>
          </div>
        )}

        {step === 'photos' && (
          <div className="space-y-4">
            <div className="text-xs text-gray-500 dark:text-[#70707d] bg-amber-50 dark:bg-[#1e1e2a] border border-amber-200 dark:border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2">
              Photos are optional — you can skip now and add them later from the review page. AI
              picks the cover and places the rest contextually.
            </div>

            {images.length < 10 && (
              <div
                onClick={() => photoInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-[rgba(255,255,255,0.1)] rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-[#6B2AEA] hover:bg-blue-50 dark:hover:bg-[rgba(107,42,234,0.05)] transition-colors"
              >
                <p className="text-sm font-medium text-gray-700 dark:text-[#c3c3cc]">
                  Click to add photos
                </p>
                <p className="text-xs text-gray-400 dark:text-[#70707d] mt-1">
                  Up to {10 - images.length} more · JPG, PNG, HEIC
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="hidden"
                  onChange={handleTripPhotoSelect}
                />
              </div>
            )}

            {images.length > 0 && (
              <div className="space-y-3">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-lg p-3"
                  >
                    <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-[#272735] relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.localPreview} alt="" className="w-full h-full object-cover" />
                      {img.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1 px-1">
                          <span className="text-white text-[10px] font-semibold">
                            {img.progress != null ? `${img.progress}%` : '…'}
                          </span>
                          <div className="w-full bg-white/30 rounded-full h-1">
                            <div
                              className="bg-white h-1 rounded-full transition-all duration-150"
                              style={{ width: `${img.progress ?? 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        placeholder="Describe this photo — where, what, why it matters"
                        value={img.description}
                        onChange={(e) => patchImage(i, { description: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#1e1e2a] text-gray-900 dark:text-[#ededf3] placeholder:text-gray-400 dark:placeholder:text-[#70707d] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#6B2AEA]"
                      />
                      {rows.length > 0 && (
                        <select
                          value={img.day ?? ''}
                          onChange={(e) =>
                            patchImage(i, {
                              day: e.target.value ? parseInt(e.target.value, 10) : undefined,
                            })
                          }
                          aria-label="Associate photo with an entry"
                          className="px-2 py-1 text-xs border border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#1e1e2a] text-gray-600 dark:text-[#c3c3cc] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#6B2AEA]"
                        >
                          <option value="">Entry (optional)</option>
                          {rows.map((r, idx) => {
                            const tag = rowField ? (r[rowField] as string) : '';
                            return (
                              <option key={idx} value={idx + 1}>
                                {idx + 1}
                                {tag ? ` — ${tag}` : ''}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>

                    <button
                      onClick={() => removeImage(i)}
                      aria-label={`Remove photo ${i + 1}`}
                      className="text-gray-400 dark:text-[#70707d] hover:text-red-500 text-lg leading-none flex-shrink-0 mt-0.5"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {errorBox}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => go(-1)} className="flex-shrink-0">
                Back
              </Button>
              {completedImagesCount > 0 && (
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                >
                  {loading
                    ? 'Setting up interview…'
                    : `Start Interview (${completedImagesCount} photo${completedImagesCount > 1 ? 's' : ''})`}
                </Button>
              )}
              <Button
                size="lg"
                variant={completedImagesCount > 0 ? 'secondary' : undefined}
                className={completedImagesCount > 0 ? 'flex-shrink-0' : 'flex-1'}
                onClick={() => handleSubmit(true)}
                disabled={loading || !isLast}
              >
                {loading ? 'Setting up…' : completedImagesCount > 0 ? 'Skip photos' : 'Start Interview'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
