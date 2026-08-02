import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button, Card, EmptyState, Header, InputField, LoadingSpinner, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useShop } from '../../context/AuthContext';
import type { SettingsScreenProps } from '../../navigation/types';
import type { Tables } from '../../lib/database.types';

type FieldDefinition = Tables<'measurement_field_definitions'>;

/** Turns a free-typed label into a stable, unique-per-shop storage key. */
function toFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function CustomMeasurementFieldsScreen({ navigation }: SettingsScreenProps<'CustomMeasurementFields'>) {
  const { t } = useTranslation('settings');
  const shop = useShop();
  const showToast = useToast();

  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('measurement_field_definitions')
        .select('*')
        .eq('shop_id', shop.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setFields(data ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('customMeasurementFields.loadError'), 'error');
    }
  }, [shop.id, showToast, t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const fieldKey = toFieldKey(label);
    if (!fieldKey) return;
    if (fields.some((f) => f.field_key === fieldKey)) {
      showToast(t('customMeasurementFields.duplicateError'), 'error');
      return;
    }

    setSaving(true);
    try {
      const nextSortOrder = fields.length > 0 ? Math.max(...fields.map((f) => f.sort_order)) + 1 : 0;
      const { data, error } = await supabase
        .from('measurement_field_definitions')
        .insert({ shop_id: shop.id, label, field_key: fieldKey, sort_order: nextSortOrder })
        .select('*')
        .single();
      if (error) throw error;
      setFields((prev) => [...prev, data]);
      setNewLabel('');
      showToast(t('customMeasurementFields.saveSuccess'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('customMeasurementFields.saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    const prev = fields;
    setFields((current) => current.filter((f) => f.id !== id));
    try {
      const { error } = await supabase.from('measurement_field_definitions').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      setFields(prev);
      showToast(err instanceof Error ? err.message : t('customMeasurementFields.deleteError'), 'error');
    }
  };

  if (loading) return <LoadingSpinner fullScreen text={t('customMeasurementFields.loading')} />;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Header title={t('customMeasurementFields.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 224, gap: 16 }}>
        <Card>
          <Text className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-50">
            {t('customMeasurementFields.addFieldTitle')}
          </Text>
          <InputField
            label={t('customMeasurementFields.fieldNameLabel')}
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder={t('customMeasurementFields.fieldNamePlaceholder')}
          />
          <Button
            title={t('customMeasurementFields.save')}
            onPress={handleAdd}
            loading={saving}
            disabled={!newLabel.trim()}
            className="mt-3"
          />
        </Card>

        <View>
          <Text className="mb-2 px-1 text-base font-semibold text-gray-500 dark:text-gray-400">
            {t('customMeasurementFields.listTitle')}
          </Text>
          {fields.length === 0 ? (
            <EmptyState
              variant="compact"
              icon="ruler-combined"
              title={t('customMeasurementFields.emptyTitle')}
              description={t('customMeasurementFields.emptyDescription')}
            />
          ) : (
            <Card>
              {fields.map((field, index) => (
                <View
                  key={field.id}
                  className={`flex-row items-center justify-between py-3.5 ${
                    index === fields.length - 1 ? '' : 'border-b border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <Text className="font-sans text-base font-medium text-gray-800 dark:text-gray-200">
                    {field.label}
                  </Text>
                  <Pressable
                    onPress={() => handleRemove(field.id)}
                    hitSlop={10}
                    className="h-9 w-9 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
                  >
                    <FontAwesome5 name="trash-alt" size={14} color="#DC2626" />
                  </Pressable>
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
