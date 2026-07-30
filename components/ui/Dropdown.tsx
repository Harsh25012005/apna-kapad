import { useState } from 'react';
import { Modal, Pressable, Text, View, FlatList } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export type DropdownOption<T extends string = string> = { label: string; value: T };

export type DropdownProps<T extends string = string> = {
  label?: string;
  value: T | '';
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  error?: string;
};

export function Dropdown<T extends string = string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: DropdownProps<T>) {
  const { t } = useTranslation('common');
  const placeholderText = placeholder ?? t('fields.select');
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View className="w-full mb-4">
      {label ? (
        <Text className="mb-1.5 text-xs font-bold uppercase tracking-[0.4px] text-gray-500">
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        className={`h-[52px] flex-row items-center justify-between rounded-md border bg-gray-50 px-4 ${
          error ? 'border-danger' : 'border-gray-200'
        }`}
      >
        <Text className={selected ? 'text-base text-gray-900' : 'text-base text-gray-400'}>
          {selected ? selected.label : placeholderText}
        </Text>
        <FontAwesome5 name="chevron-down" size={12} color="#9CA3AF" />
      </Pressable>

      {error ? <Text className="mt-1.5 text-xs font-medium text-danger">{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[60%] rounded-t-md bg-white p-4" onPress={() => {}}>
            {label ? (
              <Text className="mb-3 text-base font-semibold text-gray-900">{label}</Text>
            ) : null}
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between py-3"
                >
                  <Text className="font-sans text-base text-gray-800">{item.label}</Text>
                  {item.value === value ? (
                    <FontAwesome5 name="check" size={14} color="#2563EB" />
                  ) : null}
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View className="h-px bg-gray-100" />}
              ListEmptyComponent={
                <Text className="font-sans py-3 text-sm text-gray-400">{t('fields.noOptions')}</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
