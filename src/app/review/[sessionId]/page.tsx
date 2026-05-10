import { ReviewPanel } from '@/components/review-panel';

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <div className="py-4">
      <ReviewPanel sessionId={sessionId} />
    </div>
  );
}
