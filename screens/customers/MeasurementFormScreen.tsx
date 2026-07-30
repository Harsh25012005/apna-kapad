import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Header, InputField, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useShop } from '../../context/AuthContext';
import type { CustomersScreenProps } from '../../navigation/types';

/** Empty string -> null, otherwise a number (so blank fields stay NULL in Postgres). */
function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function MeasurementFormScreen({
  navigation,
  route,
}: CustomersScreenProps<'MeasurementForm'>) {
  const { customerId } = route.params;
  const shop = useShop();
  const showToast = useToast();

  const [garmentType, setGarmentType] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [shoulder, setShoulder] = useState('');
  const [length, setLength] = useState('');
  const [sleeve, setSleeve] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!garmentType.trim()) {
      setError('Garment type is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: insertError } = await supabase.from('measurements').insert({
        shop_id: shop.id,
        customer_id: customerId,
        garment_type: garmentType.trim(),
        chest: toNumberOrNull(chest),
        waist: toNumberOrNull(waist),
        shoulder: toNumberOrNull(shoulder),
        length: toNumberOrNull(length),
        sleeve: toNumberOrNull(sleeve),
        notes: notes.trim() || null,
      });
      if (insertError) throw insertError;
      showToast('Measurement saved', 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save measurement', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="New Measurement" onBack={() => navigation.goBack()} />
      <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20 }}>
        <InputField
          label="Garment Type"
          value={garmentType}
          onChangeText={setGarmentType}
          placeholder="e.g. Shirt, Kurta, Pant"
          leftIcon="tshirt"
          error={error}
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <InputField
              label="Chest (in)"
              value={chest}
              onChangeText={setChest}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <InputField
              label="Waist (in)"
              value={waist}
              onChangeText={setWaist}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <InputField
              label="Shoulder (in)"
              value={shoulder}
              onChangeText={setShoulder}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <InputField
              label="Length (in)"
              value={length}
              onChangeText={setLength}
              keyboardType="numeric"
            />
          </View>
        </View>
        <InputField
          label="Sleeve (in)"
          value={sleeve}
          onChangeText={setSleeve}
          keyboardType="numeric"
        />
        <InputField label="Notes" value={notes} onChangeText={setNotes} multiline />
        <Button title="Save Measurement" onPress={handleSave} loading={loading} />
      </ScrollView>
    </>
  );
}
