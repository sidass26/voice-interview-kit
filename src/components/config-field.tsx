'use client';

import { Input, Select } from './ui/input';
import type { FieldDefinition } from '@/lib/config/types';

interface ConfigFieldProps {
  def: FieldDefinition;
  value: unknown;
  onChange: (value: string | number) => void;
  /** Prefix for the DOM id, so the same field id can render in two sections. */
  idPrefix?: string;
}

/**
 * Renders a single config-declared field as the appropriate control.
 * Used by every part of the intake form — top-level fields, repeating-section
 * rows, and the author profile — so a config change is reflected everywhere.
 */
export function ConfigField({ def, value, onChange, idPrefix = '' }: ConfigFieldProps) {
  const domId = `${idPrefix}${def.id}`;
  const help = def.helpText ? (
    <p className="text-xs text-gray-400 dark:text-[#70707d] mt-1">{def.helpText}</p>
  ) : null;

  if (def.type === 'select') {
    const options = [
      { value: '', label: `Select ${def.label.toLowerCase()}…` },
      ...(def.options ?? []).map((o) => ({ value: o, label: o })),
    ];
    return (
      <div>
        <Select
          id={domId}
          label={def.label}
          options={options}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={def.required}
        />
        {help}
      </div>
    );
  }

  if (def.type === 'textarea') {
    const text = (value as string) ?? '';
    return (
      <div>
        <label
          htmlFor={domId}
          className="block text-sm font-medium text-gray-700 dark:text-[#c3c3cc] mb-1.5"
        >
          {def.label}
        </label>
        <textarea
          id={domId}
          placeholder={def.placeholder}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          maxLength={def.maxLength}
          required={def.required}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#1e1e2a] text-gray-900 dark:text-[#ededf3] placeholder:text-gray-400 dark:placeholder:text-[#70707d] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#6B2AEA] focus:border-blue-500 dark:focus:border-[#6B2AEA] resize-none"
        />
        {def.maxLength ? (
          <p className="text-xs text-gray-400 dark:text-[#70707d] mt-1">
            {text.length}/{def.maxLength}
          </p>
        ) : null}
        {help}
      </div>
    );
  }

  if (def.type === 'number') {
    return (
      <div>
        <Input
          id={domId}
          label={def.label}
          type="number"
          min={def.min}
          max={def.max}
          placeholder={def.placeholder}
          // Render 0/NaN as empty so the field doesn't show a stray "0".
          value={typeof value === 'number' && !Number.isNaN(value) && value !== 0 ? value : ''}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          required={def.required}
        />
        {help}
      </div>
    );
  }

  // text | email | url | date all map to a plain Input with the matching type.
  return (
    <div>
      <Input
        id={domId}
        label={def.label}
        type={def.type}
        placeholder={def.placeholder}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        required={def.required}
      />
      {help}
    </div>
  );
}

/** True when a value satisfies a field's `required` constraint. */
export function isFilled(def: FieldDefinition, value: unknown): boolean {
  if (def.type === 'number') {
    return typeof value === 'number' && !Number.isNaN(value) && value >= (def.min ?? 1);
  }
  return typeof value === 'string' && value.trim() !== '';
}
