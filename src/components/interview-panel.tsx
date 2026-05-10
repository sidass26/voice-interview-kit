'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import type {
  TranscriptEntry,
  ItineraryDay,
  DestinationResearch,
  IntakeResponse,
} from '@/lib/types';

interface InterviewPanelProps {
  sessionId: string;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

// Lightweight topic detection from transcript text
function detectTopicsFromTranscript(
  entries: TranscriptEntry[],
  itinerary: ItineraryDay[]
): { coveredDays: Set<number>; coveredTopics: Set<string> } {
  const allText = entries.map((e) => e.text.toLowerCase()).join(' ');
  const coveredDays = new Set<number>();
  const coveredTopics = new Set<string>();

  // Check which days/cities are mentioned
  for (const day of itinerary) {
    if (day.city && allText.includes(day.city.toLowerCase())) {
      coveredDays.add(day.day);
    }
  }

  // Check cross-cutting topics
  if (/budget|cost|spent|expensive|cheap|price|money/.test(allText)) coveredTopics.add('budget');
  if (/food|eat|ate|dish|cuisine|meal|restaurant|cafe/.test(allText)) coveredTopics.add('food');
  if (/disappoint|negative|bad|worst|didn.t like|overrated|waste/.test(allText)) coveredTopics.add('negatives');
  if (/tip|advice|recommend|suggestion|know before/.test(allText)) coveredTopics.add('tips');
  if (/different|mistake|wish|regret|next time/.test(allText)) coveredTopics.add('mistakes');

  return { coveredDays, coveredTopics };
}

export function InterviewPanel({ sessionId }: InterviewPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Research & intake data
  const [researchReady, setResearchReady] = useState<boolean | null>(null);
  const [research, setResearch] = useState<DestinationResearch | null>(null);
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [showResearch, setShowResearch] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch intake data on mount
  useEffect(() => {
    const fetchIntake = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const data = await res.json();
        if (data.intake) setIntake(data.intake);
      } catch {
        // non-critical
      }
    };
    fetchIntake();
  }, [sessionId]);

  // Check research status + fetch data when ready
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/research`);
        const data = await res.json();
        const isReady = data.status !== 'pending';
        setResearchReady(isReady);
        if (isReady && data.research_data) {
          setResearch(data.research_data);
        }
      } catch {
        setResearchReady(null);
      }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Research is now baked into system prompt at session start — no mid-session injection needed.
  // The interview only starts once research is ready (button is blocked until then).

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const addTranscriptEntry = useCallback(
    (role: 'interviewer' | 'interviewee', text: string) => {
      const entry: TranscriptEntry = {
        role,
        text,
        timestamp: (Date.now() - startTimeRef.current) / 1000,
      };
      transcriptRef.current = [...transcriptRef.current, entry];
      setTranscript([...transcriptRef.current]);
    },
    []
  );

  // Mic mute/unmute toggle
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  }, []);

  const startInterview = useCallback(async () => {
    setState('connecting');
    setError(null);

    try {
      // Request mic permission FIRST
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw new Error(
          'Microphone access is required. Please allow microphone permission and try again.'
        );
      }
      streamRef.current = stream;

      // Get ephemeral token from our API
      const tokenRes = await fetch(`/api/sessions/${sessionId}/realtime`);
      if (!tokenRes.ok) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error('Failed to get realtime token');
      }
      const { ephemeralKey } = await tokenRes.json();

      // Create peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Set up audio playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioRef.current = audioEl;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // Add mic track
      pc.addTrack(stream.getTracks()[0]);

      // Create data channel for events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.addEventListener('open', () => {
        console.log('Data channel open');
        dc.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['audio', 'text'],
            },
          })
        );
      });

      dc.addEventListener('message', (e) => {
        try {
          const event = JSON.parse(e.data);

          if (event.type === 'response.audio_transcript.done') {
            addTranscriptEntry('interviewer', event.transcript);
          }

          if (event.type === 'conversation.item.input_audio_transcription.completed') {
            addTranscriptEntry('interviewee', event.transcript);
          }
        } catch {
          // Ignore parse errors
        }
      });

      // Create and send SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
        {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
        }
      );

      if (!sdpRes.ok) {
        throw new Error('Failed to establish WebRTC connection');
      }

      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: await sdpRes.text(),
      };
      await pc.setRemoteDescription(answer);

      startTimeRef.current = Date.now();
      setState('connected');
    } catch (err) {
      console.error('Failed to start interview:', err);
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      setState('error');
    }
  }, [sessionId, addTranscriptEntry]);

  const endInterview = useCallback(async () => {
    if (dcRef.current) dcRef.current.close();
    if (pcRef.current) pcRef.current.close();
    if (audioRef.current) audioRef.current.srcObject = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    setState('ended');

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'processing',
          transcriptEntries: transcriptRef.current,
          extra: {
            duration_seconds: Math.round(
              (Date.now() - startTimeRef.current) / 1000
            ),
          },
        }),
      });
    } catch (err) {
      console.error('Failed to save transcript:', err);
    }
  }, [sessionId]);

  const processInterview = useCallback(async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/process`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Processing failed');
      router.push(`/review/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setIsProcessing(false);
    }
  }, [sessionId, router]);

  // Compute progress from transcript
  const itinerary = intake?.itinerary || [];
  const { coveredDays, coveredTopics } = detectTopicsFromTranscript(
    transcript,
    itinerary
  );

  // Group itinerary by city blocks for display
  const cityBlocks: { city: string; days: number[]; covered: boolean }[] = [];
  for (const day of itinerary) {
    const lastBlock = cityBlocks[cityBlocks.length - 1];
    if (lastBlock && lastBlock.city === day.city) {
      lastBlock.days.push(day.day);
      if (coveredDays.has(day.day)) lastBlock.covered = true;
    } else {
      cityBlocks.push({
        city: day.city,
        days: [day.day],
        covered: coveredDays.has(day.day),
      });
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Top status bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">
            Interview Session
          </h1>
          <Badge
            variant={
              state === 'connected'
                ? 'success'
                : state === 'ended'
                ? 'default'
                : state === 'error'
                ? 'danger'
                : 'info'
            }
          >
            {state === 'idle' && 'Ready to start'}
            {state === 'connecting' && 'Connecting...'}
            {state === 'connected' && 'Live'}
            {state === 'ended' && 'Ended'}
            {state === 'error' && 'Error'}
          </Badge>
          {researchReady !== null && (
            <Badge variant={researchReady ? 'success' : 'warning'}>
              {researchReady ? 'Research ready' : 'Research loading...'}
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          {state === 'idle' && (
            <Button
              onClick={startInterview}
              size="lg"
              disabled={!researchReady}
            >
              {researchReady === false
                ? 'Preparing research...'
                : researchReady === null
                ? 'Loading...'
                : 'Start Interview'}
            </Button>
          )}
          {state === 'connected' && (
            <>
              <Button
                onClick={toggleMute}
                variant={isMuted ? 'danger' : 'secondary'}
              >
                {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
              </Button>
              <Button onClick={endInterview} variant="danger">
                End Interview
              </Button>
            </>
          )}
          {state === 'ended' && (
            <Button onClick={processInterview} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Generate Article'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-4">
        {/* Left column: Main interview area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Mic status indicator */}
          {state === 'connected' && (
            <Card>
              <CardContent className="flex items-center gap-4 py-4">
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isMuted
                      ? 'bg-red-100 hover:bg-red-200'
                      : 'bg-green-100 hover:bg-green-200 animate-pulse'
                  }`}
                >
                  {isMuted ? (
                    <svg
                      className="w-7 h-7 text-red-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-7 h-7 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  )}
                </button>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {isMuted
                      ? 'Microphone paused'
                      : 'Interview in progress'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isMuted
                      ? 'Tap to resume — the bot will wait for you'
                      : 'Speak naturally. Tap the mic to pause anytime.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live transcript */}
          {transcript.length > 0 && (
            <Card>
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  Transcript
                </h3>
                <span className="text-xs text-gray-400">
                  {transcript.length} entries
                </span>
              </div>
              <CardContent className="max-h-[500px] overflow-y-auto space-y-2 py-3">
                {transcript.map((entry, i) => (
                  <div
                    key={i}
                    className={`text-sm ${
                      entry.role === 'interviewer'
                        ? 'text-blue-800'
                        : 'text-gray-800'
                    }`}
                  >
                    <span className="font-medium">
                      {entry.role === 'interviewer' ? 'Bot' : 'You'}:
                    </span>{' '}
                    {entry.text}
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </CardContent>
            </Card>
          )}

          {/* Idle state */}
          {state === 'idle' && (
            <Card>
              <CardContent className="text-center py-12">
                {researchReady ? (
                  <p className="text-gray-500">
                    Research complete! Click &quot;Start Interview&quot; to begin.
                    <br />
                    Make sure your microphone is accessible.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto" />
                    <p className="text-gray-500">
                      Researching your destination to make the interview sharper...
                      <br />
                      <span className="text-xs text-gray-400">This usually takes 15-30 seconds</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Context sidebar */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Trip timeline / Progress tracker */}
          {itinerary.length > 0 && (
            <Card>
              <div className="px-4 py-2 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-700">
                  Trip Timeline
                </h3>
              </div>
              <CardContent className="py-3 space-y-1.5">
                {cityBlocks.map((block, i) => {
                  const dayLabel =
                    block.days.length === 1
                      ? `Day ${block.days[0]}`
                      : `Days ${block.days[0]}-${block.days[block.days.length - 1]}`;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                        block.covered
                          ? 'bg-green-50 text-green-800'
                          : 'text-gray-600'
                      }`}
                    >
                      <span className="flex-shrink-0">
                        {block.covered ? '✅' : '⬜'}
                      </span>
                      <span className="font-medium">{dayLabel}</span>
                      <span className="text-gray-400">—</span>
                      <span>{block.city}</span>
                    </div>
                  );
                })}

                {/* Cross-cutting topics */}
                <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                  <p className="text-[10px] uppercase text-gray-400 font-medium px-2">
                    Cross-cutting
                  </p>
                  {[
                    { key: 'food', label: 'Food & Restaurants' },
                    { key: 'budget', label: 'Budget' },
                    { key: 'negatives', label: 'Disappointments' },
                    { key: 'tips', label: 'Tips & Advice' },
                    { key: 'mistakes', label: 'Mistakes / Do Differently' },
                  ].map((topic) => (
                    <div
                      key={topic.key}
                      className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                        coveredTopics.has(topic.key)
                          ? 'bg-green-50 text-green-800'
                          : 'text-gray-600'
                      }`}
                    >
                      <span>
                        {coveredTopics.has(topic.key) ? '✅' : '⬜'}
                      </span>
                      <span>{topic.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Research notes */}
          {research && (
            <Card>
              <div
                className="px-4 py-2 border-b border-gray-100 flex items-center justify-between cursor-pointer"
                onClick={() => setShowResearch(!showResearch)}
              >
                <h3 className="text-sm font-medium text-gray-700">
                  Research Notes
                </h3>
                <span className="text-xs text-gray-400">
                  {showResearch ? '▼' : '▶'}
                </span>
              </div>
              {showResearch && (
                <CardContent className="py-3 max-h-96 overflow-y-auto space-y-3">
                  {/* Summary */}
                  <p className="text-xs text-gray-600">{research.summary}</p>

                  {/* City-specific research */}
                  {research.cityResearch &&
                    Object.entries(research.cityResearch).map(
                      ([city, hints]) => (
                        <div key={city}>
                          <p className="text-xs font-semibold text-gray-800 mb-1">
                            {city}
                          </p>
                          {hints.food?.length > 0 && (
                            <div className="mb-1">
                              <span className="text-[10px] uppercase text-gray-400">
                                Food:{' '}
                              </span>
                              <span className="text-xs text-gray-600">
                                {hints.food.join(', ')}
                              </span>
                            </div>
                          )}
                          {hints.activities?.length > 0 && (
                            <div className="mb-1">
                              <span className="text-[10px] uppercase text-gray-400">
                                Activities:{' '}
                              </span>
                              <span className="text-xs text-gray-600">
                                {hints.activities.join(', ')}
                              </span>
                            </div>
                          )}
                          {hints.commonMistakes?.length > 0 && (
                            <div className="mb-1">
                              <span className="text-[10px] uppercase text-gray-400">
                                Watch out:{' '}
                              </span>
                              <span className="text-xs text-gray-600">
                                {hints.commonMistakes.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    )}

                  {/* Unique angles */}
                  {research.uniqueAngles?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-medium mb-1">
                        Angles to explore
                      </p>
                      {research.uniqueAngles.map((angle, i) => (
                        <p key={i} className="text-xs text-gray-600">
                          • {angle}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Reddit questions */}
                  {research.redditQuestions?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-medium mb-1">
                        Questions travelers ask
                      </p>
                      {research.redditQuestions.slice(0, 5).map((q, i) => (
                        <p key={i} className="text-xs text-gray-600">
                          • {q}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
