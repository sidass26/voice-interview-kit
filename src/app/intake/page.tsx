import { IntakeForm, type IntakeFormConfig } from '@/components/intake-form';
import { getConfig } from '@/lib/config';

export default function IntakePage() {
  const cfg = getConfig();

  // Only the serializable slice crosses into the client component. Passing the
  // whole config would ship every prompt-builder string to the browser bundle.
  // The round-trip through JSON also strips `as const` readonly modifiers.
  const formConfig: IntakeFormConfig = JSON.parse(
    JSON.stringify({
      fields: cfg.intake.fields,
      repeatingSection: cfg.intake.repeatingSection ?? null,
      profileFields: cfg.subject.profileFields,
      subjectLabel: cfg.subject.label,
    })
  );

  return (
    <div className="py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#ededf3]">
          {cfg.branding.appName}
        </h1>
        {cfg.branding.tagline && (
          <p className="text-gray-500 dark:text-[#c3c3cc] mt-2">{cfg.branding.tagline}</p>
        )}
      </div>
      <IntakeForm config={formConfig} />
    </div>
  );
}
