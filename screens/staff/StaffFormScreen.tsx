import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Dropdown, Header, InputField, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useShop } from '../../context/AuthContext';
import type { SettingsScreenProps } from '../../navigation/types';
import type { WageType } from '../../types';

const WAGE_TYPES: { label: string; value: WageType }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Per Piece', value: 'per_piece' },
];

export default function StaffFormScreen({ navigation, route }: SettingsScreenProps<'StaffForm'>) {
  const staffId = route.params?.staffId;
  const shop = useShop();
  const showToast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [wageType, setWageType] = useState<WageType>('monthly');
  const [wageAmount, setWageAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!staffId) return;
    void (async () => {
      const { data } = await supabase.from('staff').select('*').eq('id', staffId).single();
      if (!data) return;
      setName(data.name);
      setPhone(data.phone ?? '');
      setRole(data.role ?? '');
      setWageType(data.wage_type);
      setWageAmount(String(data.wage_amount ?? ''));
    })();
  }, [staffId]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const parsedWage = Number(wageAmount.trim());
      const payload = {
        shop_id: shop.id,
        name: name.trim(),
        phone: phone.trim() || null,
        role: role.trim() || null,
        wage_type: wageType,
        wage_amount: Number.isFinite(parsedWage) && parsedWage > 0 ? parsedWage : 0,
      };

      const { error: saveError } = staffId
        ? await supabase.from('staff').update(payload).eq('id', staffId)
        : await supabase.from('staff').insert(payload);
      if (saveError) throw saveError;

      showToast(staffId ? 'Staff updated' : 'Staff added', 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save staff', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title={staffId ? 'Edit Staff' : 'Add Staff'} onBack={() => navigation.goBack()} />
      <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20 }}>
        <InputField
          label="Name"
          value={name}
          onChangeText={setName}
          leftIcon="user"
          error={error}
        />
        <InputField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          leftIcon="phone"
        />
        <InputField
          label="Role"
          value={role}
          onChangeText={setRole}
          placeholder="e.g. Tailor, Cutter"
          leftIcon="tag"
        />
        <Dropdown<WageType>
          label="Wage Type"
          value={wageType}
          onChange={setWageType}
          options={WAGE_TYPES}
        />
        <InputField
          label="Wage Amount"
          value={wageAmount}
          onChangeText={setWageAmount}
          keyboardType="numeric"
          leftIcon="rupee-sign"
        />
        <Button
          title={staffId ? 'Update Staff' : 'Save Staff'}
          onPress={handleSave}
          loading={loading}
        />
      </ScrollView>
    </>
  );
}
