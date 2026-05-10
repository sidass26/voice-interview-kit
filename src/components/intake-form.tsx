'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Input, Select } from './ui/input';
import { Card, CardHeader, CardContent } from './ui/card';
import type { ItineraryDay, TripImage } from '@/lib/types';

const PURPOSE_OPTIONS = [
  { value: '', label: 'Select purpose...' },
  { value: 'leisure', label: 'Leisure / Holiday' },
  { value: 'honeymoon', label: 'Honeymoon' },
  { value: 'anniversary', label: 'Anniversary Trip' },
  { value: 'work+leisure', label: 'Work + Leisure (Bleisure)' },
  { value: 'adventure', label: 'Adventure / Outdoors' },
  { value: 'cultural', label: 'Cultural / Historical' },
  { value: 'food', label: 'Food & Culinary' },
  { value: 'family', label: 'Family Vacation' },
  { value: 'friends', label: 'Friends Trip' },
  { value: 'solo', label: 'Solo Trip' },
  { value: 'other', label: 'Other' },
];

const STEP_LABELS = ['Trip basics', 'Itinerary', 'Your profile', 'Photos'];

interface UploadedImage extends TripImage {
  localPreview: string;
  uploading?: boolean;
  progress?: number; // 0–100
}

export function IntakeForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: basics
  const [form, setForm] = useState({
    employee_name: '',
    work_email: '',
    destination_country: '',
    trip_type: '',
    trip_purpose: '',
    num_travelers: 1,
    trip_duration_days: 0,
    trip_start_date: '',
    trip_end_date: '',
  });

  // Step 2: itinerary
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([]);

  // Step 3: author profile
  const [authorProfile, setAuthorProfile] = useState({
    role: '',
    bio: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    photo_url: null as string | null,
    photo_storage_path: null as string | null,
  });
  const [authorPhotoUploading, setAuthorPhotoUploading] = useState(false);
  const authorPhotoRef = useRef<HTMLInputElement>(null);

  // Step 4: trip photos
  const [images, setImages] = useState<UploadedImage[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const update = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateAuthor = (field: string, value: string) =>
    setAuthorProfile((prev) => ({ ...prev, [field]: value }));

  const handleDurationChange = (days: number) => {
    const clamped = Math.max(1, Math.min(days, 30));
    update('trip_duration_days', clamped);
    setItinerary((prev) => {
      const newItinerary: ItineraryDay[] = [];
      for (let i = 1; i <= clamped; i++) {
        const existing = prev.find((d) => d.day === i);
        const prevCity = i > 1 ? (newItinerary[i - 2]?.city || '') : '';
        newItinerary.push(existing || { day: i, city: prevCity, notes: '' });
      }
      return newItinerary;
    });
  };

  const updateDay = (dayIndex: number, field: 'city' | 'notes', value: string) => {
    setItinerary((prev) => {
      const updated = [...prev];
      updated[dayIndex] = { ...updated[dayIndex], [field]: value };
      if (field === 'city' && dayIndex < updated.length - 1) {
        const oldCity = prev[dayIndex].city;
        for (let i = dayIndex + 1; i < updated.length; i++) {
          if (updated[i].city === oldCity || updated[i].city === '') {
            updated[i] = { ...updated[i], city: value };
          } else {
            break;
          }
        }
      }
      return updated;
    });
  };

  const handleAuthorPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form.work_email) return;

    setAuthorPhotoUploading(true);
    const localUrl = URL.createObjectURL(file);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'author');
      fd.append('email', form.work_email);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url, storagePath } = await res.json();
      setAuthorProfile((prev) => ({
        ...prev,
        photo_url: url,
        photo_storage_path: storagePath,
      }));
    } catch {
      setError('Photo upload failed — you can add it later.');
    } finally {
      setAuthorPhotoUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const uploadWithProgress = (file: File, fd: FormData, slotIndex: number): Promise<void> =>
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

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const { url, storagePath } = JSON.parse(xhr.responseText);
            setImages((prev) => {
              const updated = [...prev];
              updated[slotIndex] = { ...updated[slotIndex], url, storagePath, uploading: false, progress: 100 };
              return updated;
            });
          } catch {
            setImages((prev) => {
              const updated = [...prev];
              updated[slotIndex] = { ...updated[slotIndex], uploading: false };
              return updated;
            });
          }
        } else {
          setImages((prev) => {
            const updated = [...prev];
            updated[slotIndex] = { ...updated[slotIndex], uploading: false };
            return updated;
          });
        }
        resolve();
      };

      xhr.onerror = () => {
        setImages((prev) => {
          const updated = [...prev];
          updated[slotIndex] = { ...updated[slotIndex], uploading: false };
          return updated;
        });
        resolve();
      };

      xhr.send(fd);
    });

  const handleTripPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const tempId = `temp-${form.work_email.replace('@', '_')}-${Date.now()}`;
    const slots = files.slice(0, 10 - images.length);

    const newImages: UploadedImage[] = slots.map((file) => ({
      url: '',
      storagePath: '',
      description: '',
      localPreview: URL.createObjectURL(file),
      uploading: true,
      progress: 0,
    }));

    const startIndex = images.length;
    setImages((prev) => [...prev, ...newImages]);

    await Promise.all(
      slots.map((file, i) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', 'trip');
        fd.append('sessionId', tempId);
        return uploadWithProgress(file, fd, startIndex + i);
      })
    );

    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const updateImageDescription = (index: number, description: string) => {
    setImages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], description };
      return updated;
    });
  };

  const updateImageDay = (index: number, day: number | undefined) => {
    setImages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], day };
      return updated;
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      URL.revokeObjectURL(prev[index].localPreview);
      return updated;
    });
  };

  const uniqueCities = [...new Set(itinerary.map((d) => d.city).filter(Boolean))];

  const canProceedToStep2 =
    form.employee_name &&
    form.work_email &&
    form.destination_country &&
    form.trip_duration_days >= 1 &&
    form.trip_purpose;

  const canProceedToStep3 =
    itinerary.length > 0 && itinerary.some((d) => d.city.trim() !== '');

  const handleSubmit = async (skipPhotos = false) => {
    setLoading(true);
    setError(null);

    try {
      const cities = uniqueCities;
      if (cities.length === 0) {
        setError('Please enter at least one city in the itinerary');
        setLoading(false);
        return;
      }

      // Save author profile (fire-and-forget, non-blocking)
      if (authorProfile.role || authorProfile.bio || authorProfile.photo_url) {
        fetch('/api/author-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_email: form.work_email,
            employee_name: form.employee_name,
            ...authorProfile,
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

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_name: form.employee_name,
          work_email: form.work_email,
          destination_country: form.destination_country,
          destination_cities: cities,
          trip_type: form.trip_type,
          trip_purpose: form.trip_purpose,
          num_travelers: form.num_travelers,
          trip_duration_days: form.trip_duration_days,
          trip_start_date: form.trip_start_date || null,
          trip_end_date: form.trip_end_date || null,
          itinerary,
          images: readyImages,
        }),
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

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-[#ededf3]">
          {step === 1 && 'Tell us about your trip'}
          {step === 2 && 'Map your trip day by day'}
          {step === 3 && 'Your author profile'}
          {step === 4 && 'Add trip photos'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#c3c3cc] mt-1">
          {step === 1 && 'Quick basics so we can tailor the interview.'}
          {step === 2 && 'This helps us walk through your trip chronologically.'}
          {step === 3 && 'Shown on your published article for EEAT credibility. You can skip this and add it later.'}
          {step === 4 && 'Photos appear contextually in the article. AI picks the cover. You can skip and add later.'}
        </p>
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mt-3">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5 flex-1">
              <div className={`h-1.5 flex-1 rounded-full transition-colors ${step > i ? 'bg-blue-600 dark:bg-[#6B2AEA]' : step === i + 1 ? 'bg-blue-400 dark:bg-[#9B59E8]' : 'bg-gray-200 dark:bg-[#272735]'}`} />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-1">
          {STEP_LABELS.map((label, i) => (
            <span
              key={label}
              className={`flex-1 text-center text-[10px] font-medium ${step === i + 1 ? 'text-blue-600 dark:text-[#A78BFA]' : 'text-gray-400 dark:text-[#70707d]'}`}
            >
              {label}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="employee_name"
                label="Your name"
                placeholder="Alex Johnson"
                value={form.employee_name}
                onChange={(e) => update('employee_name', e.target.value)}
                required
              />
              <Input
                id="work_email"
                label="Work email"
                type="email"
                placeholder="jane@company.com"
                value={form.work_email}
                onChange={(e) => update('work_email', e.target.value)}
                required
              />
            </div>

            <Input
              id="destination_country"
              label="Destination country"
              placeholder="Japan"
              value={form.destination_country}
              onChange={(e) => update('destination_country', e.target.value)}
              required
            />

            <Input
              id="trip_type"
              label="Trip in a nutshell"
              placeholder="5 days in Tokyo and Kyoto, mostly food and temples"
              value={form.trip_type}
              onChange={(e) => update('trip_type', e.target.value)}
            />

            <div className="grid grid-cols-3 gap-4">
              <Select
                id="trip_purpose"
                label="Purpose"
                options={PURPOSE_OPTIONS}
                value={form.trip_purpose}
                onChange={(e) => update('trip_purpose', e.target.value)}
                required
              />
              <Input
                id="num_travelers"
                label="Travelers"
                type="number"
                min={1}
                max={20}
                value={form.num_travelers}
                onChange={(e) => update('num_travelers', parseInt(e.target.value) || 1)}
                required
              />
              <Input
                id="trip_duration_days"
                label="Duration (days)"
                type="number"
                min={1}
                max={30}
                placeholder="5"
                value={form.trip_duration_days || ''}
                onChange={(e) => handleDurationChange(parseInt(e.target.value) || 0)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="trip_start_date"
                label="Trip start date (optional)"
                type="date"
                value={form.trip_start_date}
                onChange={(e) => update('trip_start_date', e.target.value)}
              />
              <Input
                id="trip_end_date"
                label="Trip end date (optional)"
                type="date"
                value={form.trip_end_date}
                onChange={(e) => update('trip_end_date', e.target.value)}
              />
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={() => setStep(2)}
              disabled={!canProceedToStep2}
            >
              Next — Map your itinerary
            </Button>
          </div>
        )}

        {/* Step 2: Itinerary */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-[#c3c3cc] bg-gray-50 dark:bg-[#272735] rounded-lg px-4 py-2">
              <span>
                {form.destination_country} · {form.trip_duration_days} days
                {uniqueCities.length > 0 && ` · ${uniqueCities.join(', ')}`}
              </span>
              <button onClick={() => setStep(1)} className="text-blue-600 dark:text-[#A78BFA] hover:underline">
                Edit basics
              </button>
            </div>

            {itinerary.length > 3 && (
              <div className="text-xs text-gray-400 dark:text-[#70707d] bg-gray-50 dark:bg-[#1e1e2a] rounded px-3 py-2">
                💡 City auto-fills from the previous day — update it when you change cities.
              </div>
            )}

            <div className="space-y-2">
              {itinerary.map((day, i) => (
                <div
                  key={day.day}
                  className="flex items-start gap-3 border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 hover:border-gray-300 dark:hover:border-[rgba(107,42,234,0.3)] transition-colors"
                >
                  <div className="flex-shrink-0 w-12 pt-1">
                    <span className="text-sm font-medium text-gray-500 dark:text-[#70707d]">Day {day.day}</span>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="City / area"
                      value={day.city}
                      onChange={(e) => updateDay(i, 'city', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#1e1e2a] text-gray-900 dark:text-[#ededf3] placeholder:text-gray-400 dark:placeholder:text-[#70707d] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#6B2AEA] focus:border-blue-500 dark:focus:border-[#6B2AEA]"
                    />
                    <input
                      type="text"
                      placeholder="What did you do? (optional)"
                      value={day.notes}
                      onChange={(e) => updateDay(i, 'notes', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#1e1e2a] text-gray-600 dark:text-[#c3c3cc] placeholder:text-gray-400 dark:placeholder:text-[#70707d] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#6B2AEA] focus:border-blue-500 dark:focus:border-[#6B2AEA]"
                    />
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex-shrink-0">
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={() => setStep(3)}
                disabled={!canProceedToStep3}
              >
                Next — Your profile
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Author profile */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Photo upload */}
            <div className="flex items-start gap-4">
              <div
                className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 dark:border-[rgba(255,255,255,0.15)] flex items-center justify-center cursor-pointer hover:border-blue-400 dark:hover:border-[#6B2AEA] transition-colors flex-shrink-0 overflow-hidden bg-gray-50 dark:bg-[#272735]"
                onClick={() => authorPhotoRef.current?.click()}
              >
                {authorProfile.photo_url ? (
                  <img src={authorProfile.photo_url} alt="Author" className="w-full h-full object-cover" />
                ) : authorPhotoUploading ? (
                  <span className="text-xs text-gray-400 dark:text-[#70707d]">Uploading...</span>
                ) : (
                  <span className="text-2xl">📷</span>
                )}
              </div>
              <input
                ref={authorPhotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAuthorPhotoSelect}
                disabled={!form.work_email}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-[#c3c3cc]">Profile photo</p>
                <p className="text-xs text-gray-500 dark:text-[#70707d] mt-0.5">
                  Shown in the author box on your article. Builds reader trust.
                </p>
                <button
                  onClick={() => authorPhotoRef.current?.click()}
                  disabled={!form.work_email || authorPhotoUploading}
                  className="mt-2 text-xs text-blue-600 dark:text-[#A78BFA] hover:underline disabled:text-gray-400 dark:disabled:text-[#70707d]"
                >
                  {authorProfile.photo_url ? 'Change photo' : 'Upload photo'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="author_role"
                label="Your role at [Company]"
                placeholder="Senior Product Manager"
                value={authorProfile.role}
                onChange={(e) => updateAuthor('role', e.target.value)}
              />
              <Input
                id="author_twitter"
                label="Twitter / X handle"
                placeholder="@username"
                value={authorProfile.twitter}
                onChange={(e) => updateAuthor('twitter', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#c3c3cc] mb-1.5">
                Short bio
              </label>
              <textarea
                placeholder="I'm a Product Manager who travels solo every few months. I care most about finding local food and avoiding tourist traps."
                value={authorProfile.bio}
                onChange={(e) => updateAuthor('bio', e.target.value)}
                rows={3}
                maxLength={300}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#1e1e2a] text-gray-900 dark:text-[#ededf3] placeholder:text-gray-400 dark:placeholder:text-[#70707d] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#6B2AEA] focus:border-blue-500 dark:focus:border-[#6B2AEA] resize-none"
              />
              <p className="text-xs text-gray-400 dark:text-[#70707d] mt-1">{authorProfile.bio.length}/300</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="author_instagram"
                label="Instagram"
                placeholder="@username"
                value={authorProfile.instagram}
                onChange={(e) => updateAuthor('instagram', e.target.value)}
              />
              <Input
                id="author_linkedin"
                label="LinkedIn URL"
                placeholder="linkedin.com/in/username"
                value={authorProfile.linkedin}
                onChange={(e) => updateAuthor('linkedin', e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(2)} className="flex-shrink-0">
                Back
              </Button>
              <Button size="lg" className="flex-1" onClick={() => setStep(4)}>
                Next — Add photos
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Trip photos */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-xs text-gray-500 dark:text-[#70707d] bg-amber-50 dark:bg-[#1e1e2a] border border-amber-200 dark:border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2">
              📸 Photos are optional — you can skip now and add them later from the review page. AI will pick the cover and place others contextually in the article.
            </div>

            {/* Upload area */}
            {images.length < 10 && (
              <div
                onClick={() => photoInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-[rgba(255,255,255,0.1)] rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-[#6B2AEA] hover:bg-blue-50 dark:hover:bg-[rgba(107,42,234,0.05)] transition-colors"
              >
                <div className="text-3xl mb-2">🖼️</div>
                <p className="text-sm font-medium text-gray-700 dark:text-[#c3c3cc]">Click to add photos</p>
                <p className="text-xs text-gray-400 dark:text-[#70707d] mt-1">Up to {10 - images.length} more · JPG, PNG, HEIC</p>
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

            {/* Photo cards */}
            {images.length > 0 && (
              <div className="space-y-3">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-lg p-3"
                  >
                    {/* Preview */}
                    <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-[#272735] relative">
                      <img
                        src={img.localPreview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
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

                    {/* Fields */}
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        placeholder="Describe this photo — where, what, why it matters"
                        value={img.description}
                        onChange={(e) => updateImageDescription(i, e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#1e1e2a] text-gray-900 dark:text-[#ededf3] placeholder:text-gray-400 dark:placeholder:text-[#70707d] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#6B2AEA]"
                      />
                      <select
                        value={img.day ?? ''}
                        onChange={(e) =>
                          updateImageDay(i, e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        className="px-2 py-1 text-xs border border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#1e1e2a] text-gray-600 dark:text-[#c3c3cc] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#6B2AEA]"
                      >
                        <option value="">Day (optional)</option>
                        {itinerary.map((d) => (
                          <option key={d.day} value={d.day}>
                            Day {d.day}{d.city ? ` — ${d.city}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => removeImage(i)}
                      className="text-gray-400 dark:text-[#70707d] hover:text-red-500 text-lg leading-none flex-shrink-0 mt-0.5"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(3)} className="flex-shrink-0">
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
                    ? 'Setting up interview...'
                    : `Start Interview${completedImagesCount > 0 ? ` (${completedImagesCount} photo${completedImagesCount > 1 ? 's' : ''})` : ''}`}
                </Button>
              )}
              <Button
                size="lg"
                variant={completedImagesCount > 0 ? 'secondary' : undefined}
                className={completedImagesCount > 0 ? 'flex-shrink-0' : 'flex-1'}
                onClick={() => handleSubmit(true)}
                disabled={loading}
              >
                {loading ? 'Setting up...' : completedImagesCount > 0 ? 'Skip photos' : 'Start Interview'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
