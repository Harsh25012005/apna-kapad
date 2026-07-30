import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export type DatePickerFieldProps = {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
  placeholder?: string;
};

export function DatePickerField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  error,
  placeholder,
}: DatePickerFieldProps) {
  const { t } = useTranslation('common');
  const [show, setShow] = useState(false);

  // Digits stay Western on purpose; only the month name is localised.
  const formatDate = (date: Date): string =>
    `${String(date.getDate()).padStart(2, '0')} ${t(`months.${date.getMonth() + 1}`)} ${date.getFullYear()}`;

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShow(false);
    if (event.type === 'set' && selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <View className="w-full mb-4">
      {label ? (
        <Text className="mb-1.5 text-xs font-bold uppercase tracking-[0.4px] text-gray-500">
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setShow(true)}
        className={`h-[52px] flex-row items-center justify-between rounded-md border bg-white px-4 ${
          error ? 'border-danger' : 'border-gray-200'
        }`}
      >
        <Text className={value ? 'text-base text-gray-900' : 'text-base text-gray-400'}>
          {value ? formatDate(value) : placeholder ?? t('fields.selectDate')}
        </Text>
        <FontAwesome5 name="calendar-alt" size={16} color="#6B7280" />
      </Pressable>

      {error ? <Text className="font-sans mt-1 text-xs text-danger">{error}</Text> : null}

      {show ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}
    </View>
  );
}
