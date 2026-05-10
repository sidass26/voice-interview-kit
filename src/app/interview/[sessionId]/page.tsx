import { InterviewPanel } from '@/components/interview-panel';

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <div className="py-4">
      <InterviewPanel sessionId={sessionId} />
    </div>
  );
}
