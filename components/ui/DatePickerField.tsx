import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { FontAwesome5 } from '@expo/vector-icons';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
  placeholder = 'Select date',
}: DatePickerFieldProps) {
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShow(false);
    if (event.type === 'set' && selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <View className="w-full mb-4">
      {label ? (
        <Text
          style={{ letterSpacing: 0.4 }}
          className="mb-1.5 text-xs font-bold uppercase text-gray-500"
        >
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
          {value ? formatDate(value) : placeholder}
        </Text>
        <FontAwesome5 name="calendar-alt" size={16} color="#6B7280" />
      </Pressable>

      {error ? <Text className="mt-1 text-xs text-danger">{error}</Text> : null}

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
