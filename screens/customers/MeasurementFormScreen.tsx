import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Card, Dropdown, Header, InputField, LoadingSpinner, useToast } from '../../components/ui';
import type { DropdownOption } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { runSync } from '../../lib/data/sync';
import { useShop } from '../../context/AuthContext';
import type { CustomersScreenProps } from '../../navigation/types';

/** Empty string -> null, otherwise a number (so blank fields stay NULL in Postgres). */
function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The only three garment types the shop takes orders for. Stored verbatim in garment_type. */
export const GARMENT_TYPE_VALUES = ['Shirt', 'Pant', 'Shirt+Pant'] as const;
export type GarmentType = (typeof GARMENT_TYPE_VALUES)[number];

const GARMENT_TYPE_KEYS: Record<GarmentType, string> = {
  Shirt: 'shirt',
  Pant: 'pant',
  'Shirt+Pant': 'shirtPant',
};

/**
 * A measurement input. `column` fields map onto a real `measurements` column;
 * `custom` fields have no column and round-trip through custom_fields using the
 * canonical English label as the key (only the on-screen label is translated).
 */
type MeasurementField =
  | { id: string; kind: 'column'; column: 'chest' | 'waist' | 'shoulder' | 'length' | 'sleeve' }
  | { id: string; kind: 'custom'; label: string };

const SHIRT_FIELDS: MeasurementField[] = [
  { id: 'chest', kind: 'column', column: 'chest' },
  { id: 'shoulder', kind: 'column', column: 'shoulder' },
  { id: 'sleeve', kind: 'column', column: 'sleeve' },
  { id: 'shirtLength', kind: 'column', column: 'length' },
  { id: 'collar', kind: 'custom', label: 'Collar' },
  { id: 'cuff', kind: 'custom', label: 'Cuff' },
  { id: 'biceps', kind: 'custom', label: 'Biceps' },
  { id: 'stomach', kind: 'custom', label: 'Stomach' },
  { id: 'seat', kind: 'custom', label: 'Seat' },
];

/** Pant-only: pant length owns the single `length` column. */
const PANT_FIELDS: MeasurementField[] = [
  { id: 'waist', kind: 'column', column: 'waist' },
  { id: 'pantLength', kind: 'column', column: 'length' },
  { id: 'hip', kind: 'custom', label: 'Hip' },
  { id: 'thigh', kind: 'custom', label: 'Thigh' },
  { id: 'knee', kind: 'custom', label: 'Knee' },
  { id: 'bottom', kind: 'custom', label: 'Bottom' },
  { id: 'crotch', kind: 'custom', label: 'Crotch' },
];

/**
 * Shirt+Pant: there is only one `length` column and the shirt group already
 * claims it, so the pant length is persisted as a custom field instead.
 */
const PANT_FIELDS_COMBINED: MeasurementField[] = PANT_FIELDS.map((f) =>
  f.id === 'pantLength' ? { id: 'pantLength', kind: 'custom', label: 'Pant Length' } : f
);

const GROUPS: Record<GarmentType, { shirt: MeasurementField[]; pant: MeasurementField[] }> = {
  Shirt: { shirt: SHIRT_FIELDS, pant: [] },
  Pant: { shirt: [], pant: PANT_FIELDS },
  'Shirt+Pant': { shirt: SHIRT_FIELDS, pant: PANT_FIELDS_COMBINED },
};

/** Every canonical custom label the presets own, so free-form rows never collide with them. */
const RESERVED_CUSTOM_LABELS = new Set(
  [...SHIRT_FIELDS, ...PANT_FIELDS, ...PANT_FIELDS_COMBINED]
    .filter((f): f is Extract<MeasurementField, { kind: 'custom' }> => f.kind === 'custom')
    .map((f) => f.label)
);

type CustomField = { label: string; value: string };

export default function MeasurementFormScreen({
  navigation,
  route,
}: CustomersScreenProps<'MeasurementForm'>) {
  const { t } = useTranslation('customers');
  const { customerId, measurementId } = route.params;
  const shop = useShop();
  const showToast = useToast();
  const isEditing = !!measurementId;

  const garmentTypeOptions: DropdownOption[] = useMemo(
    () =>
      GARMENT_TYPE_VALUES.map((value) => ({
        label: t(`measurementForm.garmentTypes.${GARMENT_TYPE_KEYS[value]}`),
        value,
      })),
    [t]
  );

  const [garmentType, setGarmentType] = useState('');
  /** All numeric measurement inputs, keyed by field id. */
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(true);

  const groups = useMemo(() => {
    const match = GARMENT_TYPE_VALUES.find((v) => v === garmentType);
    return match ? GROUPS[match] : { shirt: [], pant: [] };
  }, [garmentType]);

  const setValue = (id: string, value: string) =>
    setValues((prev) => ({ ...prev, [id]: value }));

  /**
   * Custom field labels aren't their own table — they live inline on every
   * measurement's `custom_fields` JSON. So "reuse across all clients" means
   * scanning every measurement this shop has ever saved and collecting the
   * distinct labels, then pre-seeding this form with them (blank, ready to
   * fill in) so a field added once for one client shows up for every client
   * afterwards instead of having to be retyped each time.
   */
  const fetchKnownCustomLabels = useCallback(async (): Promise<string[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('measurements')
        .select('custom_fields')
        .eq('shop_id', shop.id);
      if (fetchError) throw fetchError;
      const labels = new Set<string>();
      for (const row of data ?? []) {
        const fields = Array.isArray(row.custom_fields)
          ? (row.custom_fields as unknown as CustomField[])
          : [];
        for (const f of fields) {
          const label = f?.label?.trim();
          if (label && !RESERVED_CUSTOM_LABELS.has(label)) labels.add(label);
        }
      }
      return [...labels].sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }, [shop.id]);

  const load = useCallback(async () => {
    setLoadingRecord(true);
    try {
      let recordCustomFields: CustomField[] = [];

      if (measurementId) {
        const { data, error: fetchError } = await supabase
          .from('measurements')
          .select('*')
          .eq('id', measurementId)
          .single();
        if (fetchError) throw fetchError;
        if (data) {
          const type = data.garment_type ?? '';
          setGarmentType(type);

          const match = GARMENT_TYPE_VALUES.find((v) => v === type);
          const fields = match ? [...GROUPS[match].shirt, ...GROUPS[match].pant] : [];
          const stored = Array.isArray(data.custom_fields)
            ? (data.custom_fields as unknown as CustomField[])
            : [];

          const next: Record<string, string> = {};
          for (const field of fields) {
            if (field.kind === 'column') {
              next[field.id] = data[field.column]?.toString() ?? '';
            } else {
              next[field.id] = stored.find((f) => f?.label === field.label)?.value ?? '';
            }
          }
          setValues(next);
          setNotes(data.notes ?? '');
          recordCustomFields = stored.filter((f) => f && !RESERVED_CUSTOM_LABELS.has(f.label));
        }
      }

      const knownLabels = await fetchKnownCustomLabels();
      const recordLabels = new Set(recordCustomFields.map((f) => f.label));
      setCustomFields([
        ...recordCustomFields,
        ...knownLabels.filter((label) => !recordLabels.has(label)).map((label) => ({ label, value: '' })),
      ]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('measurementForm.loadError'), 'error');
    } finally {
      setLoadingRecord(false);
    }
  }, [measurementId, fetchKnownCustomLabels, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const addCustomField = () => {
    setCustomFields((prev) => [...prev, { label: '', value: '' }]);
  };

  const updateCustomField = (index: number, key: keyof CustomField, value: string) => {
    setCustomFields((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: value } : f)));
  };

  const removeCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!garmentType.trim()) {
      setError(t('measurementForm.garmentTypeRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const activeFields = [...groups.shirt, ...groups.pant];

      const columns: Record<string, number | null> = {
        chest: null,
        waist: null,
        shoulder: null,
        length: null,
        sleeve: null,
      };
      const presetCustomFields: CustomField[] = [];
      for (const field of activeFields) {
        const raw = values[field.id] ?? '';
        if (field.kind === 'column') {
          columns[field.column] = toNumberOrNull(raw);
        } else if (raw.trim()) {
          presetCustomFields.push({ label: field.label, value: raw.trim() });
        }
      }

      const cleanedCustomFields = customFields
        .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
        .filter((f) => f.label || f.value);

      const payload = {
        shop_id: shop.id,
        customer_id: customerId,
        garment_type: garmentType.trim(),
        ...columns,
        notes: notes.trim() || null,
        custom_fields: [...presetCustomFields, ...cleanedCustomFields],
      };

      // Customers are written local-first (SQLite -> pending_ops -> push),
      // but measurements go straight to Supabase. Saving a measurement for a
      // client created moments ago therefore hit a foreign-key violation,
      // because that customer row hadn't been pushed yet. Flushing the sync
      // queue first guarantees the customer exists server-side.
      await runSync(shop.id);

      if (isEditing && measurementId) {
        const { error: updateError } = await supabase
          .from('measurements')
          .update(payload)
          .eq('id', measurementId);
        if (updateError) throw updateError;
      } else {
        // Insert (not upsert): customers can have multiple measurement records,
        // one per garment type, keyed off customer_id as a foreign key.
        const { error: insertError } = await supabase.from('measurements').insert(payload);
        if (insertError) throw insertError;
      }
      showToast(t('measurementForm.saveSuccess'), 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('measurementForm.saveError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /** Renders a field group as a two-column grid. */
  const renderGroup = (fields: MeasurementField[]) => (
    <View className="-mx-1 flex-row flex-wrap">
      {fields.map((field) => (
        <View key={field.id} className="w-1/2 px-1">
          <InputField
            label={t(`measurementForm.fields.${field.id}.label`)}
            value={values[field.id] ?? ''}
            onChangeText={(v) => setValue(field.id, v)}
            placeholder={t(`measurementForm.fields.${field.id}.placeholder`)}
            keyboardType="number-pad"
          />
        </View>
      ))}
    </View>
  );

  if (loadingRecord) return <LoadingSpinner fullScreen text={t('measurementForm.loading')} />;

  return (
    <>
      <Header
        title={isEditing ? t('measurementForm.editTitle') : t('measurementForm.title')}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-950"
        contentContainerStyle={{ padding: 20, paddingBottom: 224 }}
        keyboardShouldPersistTaps="handled"
      >
        <Dropdown
          label={t('measurementForm.garmentTypeLabel')}
          value={garmentType}
          onChange={setGarmentType}
          options={garmentTypeOptions}
          placeholder={t('measurementForm.garmentTypePlaceholder')}
          error={error}
          required
        />

        {groups.shirt.length > 0 ? (
          <Card className="mb-4">
            <Text className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-50">
              {t('measurementForm.shirtSection')}
            </Text>
            {renderGroup(groups.shirt)}
          </Card>
        ) : null}

        {groups.pant.length > 0 ? (
          <Card className="mb-4">
            <Text className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-50">
              {t('measurementForm.pantSection')}
            </Text>
            {renderGroup(groups.pant)}
          </Card>
        ) : null}

        <InputField
          label={t('measurementForm.notesLabel')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('measurementForm.notesPlaceholder')}
        />

        <View className="mt-2">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
              {t('measurementForm.customFieldsLabel')}
            </Text>
            <Pressable
              onPress={addCustomField}
              className="flex-row items-center rounded-md bg-primary-50 px-3 py-1.5 dark:bg-primary-950"
            >
              <FontAwesome5 name="plus" size={11} color="#1D4ED8" />
              <Text className="ml-1.5 text-base font-semibold text-primary-600 dark:text-primary-400">
                {t('measurementForm.addCustomField')}
              </Text>
            </Pressable>
          </View>

          {customFields.length === 0 ? (
            <Text className="font-sans text-base text-gray-400 dark:text-gray-500">
              {t('measurementForm.noCustomFields')}
            </Text>
          ) : (
            <View className="gap-2">
              {customFields.map((field, index) => (
                <View key={index} className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <InputField
                      label={index === 0 ? t('measurementForm.customFieldLabelLabel') : undefined}
                      value={field.label}
                      onChangeText={(v) => updateCustomField(index, 'label', v)}
                      placeholder={t('measurementForm.customFieldLabelPlaceholder')}
                    />
                  </View>
                  <View className="flex-1">
                    <InputField
                      label={index === 0 ? t('measurementForm.customFieldValueLabel') : undefined}
                      value={field.value}
                      onChangeText={(v) => updateCustomField(index, 'value', v)}
                      placeholder={t('measurementForm.customFieldValuePlaceholder')}
                      keyboardType="number-pad"
                    />
                  </View>
                  <Pressable
                    onPress={() => removeCustomField(index)}
                    hitSlop={8}
                    className="h-6 w-6 items-center justify-center"
                  >
                    <FontAwesome5 name="trash-alt" size={15} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <Button
          title={isEditing ? t('measurementForm.updateMeasurement') : t('measurementForm.saveMeasurement')}
          onPress={handleSave}
          loading={loading}
          className="mt-4"
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
