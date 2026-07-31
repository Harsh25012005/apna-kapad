import { Image, Text, View } from 'react-native';

export type AvatarSize = 'sm' | 'md' | 'lg';

const SIZES: Record<AvatarSize, number> = { sm: 32, md: 44, lg: 64 };

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type AvatarProps = {
  name?: string | null;
  uri?: string | null;
  size?: AvatarSize;
};

export function Avatar({ name, uri, size = 'md' }: AvatarProps) {
  const dimension = SIZES[size];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
      />
    );
  }

  return (
    <View
      className="items-center justify-center bg-primary-100 dark:bg-primary-900"
      style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
    >
      <Text className="font-semibold text-primary-700 dark:text-primary-300" style={{ fontSize: dimension * 0.36 }}>
        {getInitials(name ?? '')}
      </Text>
    </View>
  );
}
