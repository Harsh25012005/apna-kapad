import { Pressable, Text, View } from 'react-native';

export type RadioButtonProps = {
  selected: boolean;
  onPress: () => void;
  label?: string;
  disabled?: boolean;
};

export function RadioButton({ selected, onPress, label, disabled = false }: RadioButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center ${disabled ? 'opacity-50' : ''}`}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? 'border-primary-600' : 'border-gray-300'
        }`}
      >
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary-600" /> : null}
      </View>
      {label ? <Text className="font-sans ml-2 text-base text-gray-800">{label}</Text> : null}
    </Pressable>
  );
}

export type RadioOption<T extends string = string> = { label: string; value: T };

export type RadioGroupProps<T extends string = string> = {
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  direction?: 'row' | 'column';
};

export function RadioGroup<T extends string = string>({
  options,
  value,
  onChange,
  direction = 'column',
}: RadioGroupProps<T>) {
  return (
    <View className={direction === 'row' ? 'flex-row flex-wrap gap-4' : 'gap-3'}>
      {options.map((opt) => (
        <RadioButton
          key={opt.value}
          selected={value === opt.value}
          onPress={() => onChange(opt.value)}
          label={opt.label}
        />
      ))}
    </View>
  );
}
