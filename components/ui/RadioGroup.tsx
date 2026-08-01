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
          selected ? 'border-primary-600' : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary-600" /> : null}
      </View>
      {label ? <Text className="font-sans ml-2 text-base text-gray-800 dark:text-gray-200">{label}</Text> : null}
    </Pressable>
  );
}

export type RadioOption<T extends string = string> = { label: string; value: T };

export type RadioGroupProps<T extends string = string> = {
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  direction?: 'row' | 'column';
  /**
   * 'dots' is the original small-circle style — fine for dense filter lists.
   * 'cards' renders each option as a full 48dp+ selectable button, for
   * choices that matter more (payment mode, priority, wage type) where a
   * tiny 20px circle is too small/easy to mis-tap on a busy counter.
   */
  variant?: 'dots' | 'cards';
};

export function RadioGroup<T extends string = string>({
  options,
  value,
  onChange,
  direction = 'column',
  variant = 'dots',
}: RadioGroupProps<T>) {
  if (variant === 'cards') {
    return (
      <View className={direction === 'row' ? 'flex-row gap-3' : 'gap-3'}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className={`min-h-[52px] flex-1 flex-row items-center justify-center rounded-md border-2 px-4 py-3 ${
                selected
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-950'
                  : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  selected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

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
