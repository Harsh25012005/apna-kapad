import type { Tables } from './database.types';

type Measurement = Tables<'measurements'>;
export type MeasurementFieldEntry = { label: string; value: string | number };

const LEGACY_COLUMN_LABELS: { column: 'chest' | 'waist' | 'shoulder' | 'length' | 'sleeve'; labelKey: string }[] = [
  { column: 'chest', labelKey: 'chest' },
  { column: 'waist', labelKey: 'waist' },
  { column: 'shoulder', labelKey: 'shoulder' },
  { column: 'length', labelKey: 'length' },
  { column: 'sleeve', labelKey: 'sleeve' },
];

/**
 * Flattens a measurement record into a single label/value list for display —
 * the legacy numeric columns (from before custom fields existed) plus
 * whatever the shop's custom_fields JSON holds, in one uniform list.
 */
export function getMeasurementFieldEntries(
  measurement: Measurement,
  t: (key: string) => string
): MeasurementFieldEntry[] {
  const customFields = Array.isArray(measurement.custom_fields)
    ? (measurement.custom_fields as unknown as { label: string; value: string }[])
    : [];

  const legacy = LEGACY_COLUMN_LABELS.map(({ column, labelKey }) => ({
    label: t(`detail.measurementFields.${labelKey}`),
    value: measurement[column] as number | null,
  }));

  return [...legacy, ...customFields]
    .filter((f) => f.value !== null && f.value !== undefined && f.value !== '')
    .map((f) => ({ label: f.label, value: f.value as string | number }));
}
