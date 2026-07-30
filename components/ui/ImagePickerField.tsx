import { Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';

export type ImagePickerFieldProps = {
  label?: string;
  uri?: string | null;
  onChange: (uri: string) => void;
  aspect?: [number, number];
  /** Where the image comes from. Defaults to the photo library. */
  source?: 'library' | 'camera';
  /** Called when the required OS permission was refused. */
  onPermissionDenied?: () => void;
};

export function ImagePickerField({
  label,
  uri,
  onChange,
  aspect = [1, 1],
  source = 'library',
  onPermissionDenied,
}: ImagePickerFieldProps) {
  const pickImage = async () => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onPermissionDenied?.();
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.7,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    const pickedUri = result.assets?.[0]?.uri;
    if (!result.canceled && pickedUri) {
      onChange(pickedUri);
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
        onPress={pickImage}
        className="h-32 w-32 items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-200 bg-gray-50 active:bg-gray-100"
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
