import { Modal as RNModal, Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { FontAwesome5 } from '@expo/vector-icons';

export type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/** Bottom-sheet style modal. */
export function BottomSheet({ visible, onClose, title, children }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="max-h-[85%] rounded-t-md bg-white p-4" onPress={() => {}}>
          {title ? (
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-gray-900">{title}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <FontAwesome5 name="times" size={18} color="#6B7280" />
              </Pressable>
            </View>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

/** Centered dialog modal — for confirmations/alerts. */
export function CenterModal({ visible, onClose, title, children }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={() => onClose()}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable className="w-full rounded-md bg-white p-5" onPress={() => {}}>
          {title ? <Text className="mb-3 text-lg font-semibold text-gray-900">{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
