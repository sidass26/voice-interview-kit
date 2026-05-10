import { IntakeForm } from '@/components/intake-form';

export default function IntakePage() {
  return (
    <div className="py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Travel Interview</h1>
        <p className="text-gray-500 mt-2">
          Tell us a bit about your trip, then we&apos;ll chat about it.
        </p>
      </div>
      <IntakeForm />
    </div>
  );
}
