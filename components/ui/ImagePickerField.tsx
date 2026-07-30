import { Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';

export type ImagePickerFieldProps = {
  label?: string;
  uri?: string | null;
  onChange: (uri: string) => void;
  aspect?: [number, number];
};

export function ImagePickerField({
  label,
  uri,
  onChange,
  aspect = [1, 1],
}: ImagePickerFieldProps) {
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.7,
    });

    const pickedUri = result.assets?.[0]?.uri;
    if (!result.canceled && pickedUri) {
      onChange(pickedUri);
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
        onPress={pickImage}
        className="h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 active:bg-gray-100"
      >
        {uri ? (
          <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="items-center">
            <View className="mb-1.5 h-9 w-9 items-center justify-center rounded-full bg-primary-50">
              <FontAwesome5 name="camera" size={14} color="#2563EB" />
            </View>
            <Text className="text-xs font-medium text-gray-400">Add photo</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
