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
import type { Tables } from '../../lib/database.types';

/** The only three garment types the shop takes orders for. Stored verbatim in garment_type. */
export const GARMENT_TYPE_VALUES = ['Shirt', 'Pant', 'Shirt+Pant'] as const;
export type GarmentType = (typeof GARMENT_TYPE_VALUES)[number];

const GARMENT_TYPE_KEYS: Record<GarmentType, string> = {
  Shirt: 'shirt',
  Pant: 'pant',
  'Shirt+Pant': 'shirtPant',
};

type FieldDefinition = Tables<'measurement_field_definitions'>;
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
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
  /** One entry per shop-defined field, in definition order — label + value. */
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [extraFields, setExtraFields] = useState<CustomField[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(true);

  const load = useCallback(async () => {
    setLoadingRecord(true);
    try {
      const { data: definitions, error: defError } = await supabase
        .from('measurement_field_definitions')
        .select('*')
        .eq('shop_id', shop.id)
        .order('sort_order', { ascending: true });
      if (defError) throw defError;
      setFieldDefinitions(definitions ?? []);

      const nextValues: Record<string, string> = {};
      let extra: CustomField[] = [];

      if (measurementId) {
        const { data, error: fetchError } = await supabase
          .from('measurements')
          .select('*')
          .eq('id', measurementId)
          .single();
        if (fetchError) throw fetchError;
        if (data) {
          setGarmentType(data.garment_type ?? '');
          setNotes(data.notes ?? '');

          const stored = Array.isArray(data.custom_fields)
            ? (data.custom_fields as unknown as CustomField[])
            : [];
          const storedByLabel = new Map(stored.map((f) => [f.label, f.value]));

          for (const def of definitions ?? []) {
            nextValues[def.field_key] = storedByLabel.get(def.label) ?? '';
          }
          // Anything stored that doesn't match a known definition label is a
          // one-off field from before this shop defined it in Settings.
          const definedLabels = new Set((definitions ?? []).map((d) => d.label));
          extra = stored.filter((f) => f.label && !definedLabels.has(f.label));
        }
      } else {
        for (const def of definitions ?? []) {
          nextValues[def.field_key] = '';
        }
      }

      setFieldValues(nextValues);
      setExtraFields(extra);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('measurementForm.loadError'), 'error');
    } finally {
      setLoadingRecord(false);
    }
  }, [measurementId, shop.id, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFieldValue = (key: string, value: string) =>
    setFieldValues((prev) => ({ ...prev, [key]: value }));

  const addExtraField = () => {
    setExtraFields((prev) => [...prev, { label: '', value: '' }]);
  };

  const updateExtraField = (index: number, key: keyof CustomField, value: string) => {
    setExtraFields((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: value } : f)));
  };

  const removeExtraField = (index: number) => {
    setExtraFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!garmentType.trim()) {
      setError(t('measurementForm.garmentTypeRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const definedCustomFields: CustomField[] = fieldDefinitions
        .map((def) => ({ label: def.label, value: (fieldValues[def.field_key] ?? '').trim() }))
        .filter((f) => f.value);

      const cleanedExtraFields = extraFields
        .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
        .filter((f) => f.label || f.value);

      const payload = {
        shop_id: shop.id,
        customer_id: customerId,
        garment_type: garmentType.trim(),
        notes: notes.trim() || null,
        custom_fields: [...definedCustomFields, ...cleanedExtraFields],
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

        {fieldDefinitions.length > 0 ? (
          <Card className="mb-4">
            <Text className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-50">
              {t('measurementForm.fieldsSection')}
            </Text>
            {/* Every field the shop has defined in Settings, entered one by
                one — order matches the order they were added in. */}
            <View className="gap-3">
              {fieldDefinitions.map((def) => (
                <InputField
                  key={def.id}
                  label={def.label}
                  value={fieldValues[def.field_key] ?? ''}
                  onChangeText={(v) => setFieldValue(def.field_key, v)}
                  placeholder={def.label}
                  keyboardType={def.input_type === 'number' ? 'number-pad' : 'default'}
                />
              ))}
            </View>
          </Card>
        ) : (
          <Text className="font-sans mb-4 text-base text-gray-400 dark:text-gray-500">
            {t('measurementForm.noFieldsDefined')}
          </Text>
        )}

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
              onPress={addExtraField}
              className="flex-row items-center rounded-md bg-primary-50 px-3 py-1.5 dark:bg-primary-950"
            >
              <FontAwesome5 name="plus" size={11} color="#1D4ED8" />
              <Text className="ml-1.5 text-base font-semibold text-primary-600 dark:text-primary-400">
                {t('measurementForm.addCustomField')}
              </Text>
            </Pressable>
          </View>

          {extraFields.length === 0 ? (
            <Text className="font-sans text-base text-gray-400 dark:text-gray-500">
              {t('measurementForm.noCustomFields')}
            </Text>
          ) : (
            <View className="gap-2">
              {extraFields.map((field, index) => (
                <View key={index} className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <InputField
                      label={index === 0 ? t('measurementForm.customFieldLabelLabel') : undefined}
                      value={field.label}
                      onChangeText={(v) => updateExtraField(index, 'label', v)}
                      placeholder={t('measurementForm.customFieldLabelPlaceholder')}
                    />
                  </View>
                  <View className="flex-1">
                    <InputField
                      label={index === 0 ? t('measurementForm.customFieldValueLabel') : undefined}
                      value={field.value}
                      onChangeText={(v) => updateExtraField(index, 'value', v)}
                      placeholder={t('measurementForm.customFieldValuePlaceholder')}
                      keyboardType="number-pad"
                    />
                  </View>
                  <Pressable
                    onPress={() => removeExtraField(index)}
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
