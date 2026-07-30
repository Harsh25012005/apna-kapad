import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Header, InputField, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useShop } from '../../context/AuthContext';
import type { CustomersScreenProps } from '../../navigation/types';

export default function CustomerFormScreen({ navigation }: CustomersScreenProps<'CustomerForm'>) {
  const shop = useShop();
  const showToast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: insertError } = await supabase.from('customers').insert({
        shop_id: shop.id,
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      });
      if (insertError) throw insertError;
      showToast('Customer added', 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save customer', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="New Customer" onBack={() => navigation.goBack()} />
      <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20 }}>
        <InputField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Customer name"
          leftIcon="user"
          error={error}
        />
        <InputField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit phone number"
          leftIcon="phone"
          keyboardType="phone-pad"
        />
        <InputField
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Address"
          leftIcon="map-marker-alt"
          multiline
        />
        <Button title="Save Customer" onPress={handleSave} loading={loading} />
      </ScrollView>
    </>
  );
}
