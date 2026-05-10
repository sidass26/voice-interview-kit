'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import type { InterviewSession, IntakeResponse } from '@/lib/types';

interface SessionWithIntake extends InterviewSession {
  intake: IntakeResponse | null;
}

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionWithIntake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSessions(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const completedCount = sessions.filter((s) => s.status === 'completed').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#ededf3]">Travel Interviews</h1>
          <p className="text-sm text-gray-500 dark:text-[#c3c3cc] mt-1">
            Capture authentic travel stories from the team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/stories">
            <Button variant="secondary" size="lg">🌍 View Globe</Button>
          </Link>
          <Link href="/intake">
            <Button size="lg">New Interview</Button>
          </Link>
        </div>
      </div>

      {/* Bulk publish CTA */}
      {completedCount > 0 && (
        <div className="bg-blue-50 dark:bg-[#1e1e2a] border border-blue-200 dark:border-[rgba(107,42,234,0.25)] rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-[#ededf3]">
              {completedCount} completed {completedCount === 1 ? 'interview' : 'interviews'}
            </p>
            <p className="text-xs text-blue-600 dark:text-[#A78BFA] mt-0.5">
              Publish all articles to your custom HTML domain or WordPress in one shot.
            </p>
          </div>
          <a
            href="/stories"
            className="text-sm font-semibold text-blue-700 dark:text-[#A78BFA] border border-blue-300 dark:border-[rgba(107,42,234,0.4)] px-4 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-[#272735] transition-colors"
          >
            View published →
          </a>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-[#70707d]">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 dark:text-[#c3c3cc] mb-4">No interviews yet. Start your first one!</p>
            <Link href="/intake">
              <Button>Start Interview</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={
                session.status === 'completed' || session.status === 'failed'
                  ? `/review/${session.id}`
                  : session.status === 'interviewing' || session.status === 'ready'
                  ? `/interview/${session.id}`
                  : `/review/${session.id}`
              }
            >
              <Card className="hover:border-blue-300 dark:hover:border-[rgba(107,42,234,0.4)] transition-colors cursor-pointer mb-3">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-[#ededf3]">
                        {session.intake
                          ? `${session.intake.destination_country} — ${session.intake.destination_cities.join(', ')}`
                          : 'Untitled Session'}
                      </span>
                      <Badge variant={statusBadgeVariant(session.status)}>
                        {session.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-[#c3c3cc]">
                      {session.intake && (
                        <>
                          {session.intake.employee_name} &middot; {session.intake.trip_type}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-[#70707d]">
                    {new Date(session.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
