'use client';

import React from 'react';
import {
  BUSINESS_MODELS,
  businessModel,
  NO_MODEL_LABEL,
  type BusinessModelId,
} from '@/lib/businessModels';
import { Field, inputClass } from '@/components/ui';

/**
 * Which commercial model a partner is on.
 *
 * Deliberately neutral in colour: the model is a fact about the contract, not
 * a status, so it must not compete with the activity badge beside it. Station
 * models carry a subtle accent tint so "has MPrnt hardware" is scannable.
 */
export function ModelBadge({
  id,
  className = '',
}: {
  id: string | null | undefined;
  className?: string;
}) {
  const model = businessModel(id);

  if (!model) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md bg-text-muted/10 text-text-muted text-xs font-medium whitespace-nowrap ${className}`}
        title="No commercial model recorded for this partner yet"
      >
        {NO_MODEL_LABEL}
      </span>
    );
  }

  const station = model.family === 'MPRNT Station';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${
        station ? 'bg-accent/10 text-accent' : 'bg-text-muted/10 text-text-muted'
      } ${className}`}
      title={`${model.label} — ${model.name}`}
    >
      {model.short}
    </span>
  );
}

/**
 * Model picker for the create and edit forms. A native select so it is
 * keyboard and screen-reader accessible for free, and opens the platform
 * picker on a phone.
 */
export function ModelField({
  value,
  onChange,
  id = 'business-model',
  label = 'Business model',
}: {
  value: BusinessModelId | '';
  onChange: (value: BusinessModelId | '') => void;
  id?: string;
  label?: string;
}) {
  const selected = businessModel(value);

  return (
    <Field
      label={label}
      htmlFor={id}
      hint={selected ? selected.hint : 'Can be set later, once the commercial terms are agreed.'}
    >
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as BusinessModelId | '')}
        className={inputClass}
      >
        <option value="">{NO_MODEL_LABEL}</option>
        {BUSINESS_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {m.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
