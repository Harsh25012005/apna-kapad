import { Pressable, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

export type CheckboxProps = {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export function Checkbox({ checked, onChange, label, disabled = false }: CheckboxProps) {
  return (
    <Pressable
      onPress={() => !disabled && onChange(!checked)}
      className={`flex-row items-center ${disabled ? 'opacity-50' : ''}`}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded border ${
          checked ? 'border-primary-600 bg-primary-600' : 'border-gray-300 bg-white'
        }`}
      >
        {checked ? <FontAwesome5 name="check" size={10} color="#FFFFFF" /> : null}
      </View>
      {label ? <Text className="font-sans ml-2 text-base text-gray-800">{label}</Text> : null}
    </Pressable>
  );
}
