import { useEffect, useState } from 'react';
import { Keyboard, Modal as RNModal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/**
 * Tracks the live keyboard height. RN's `KeyboardAvoidingView` doesn't
 * reliably resize content inside a transparent `Modal` on Android (the modal
 * renders in its own window, which the "padding"/"height" behaviors don't
 * account for) — listening to the keyboard directly and shifting the sheet
 * up by that exact height works on both platforms regardless.
 */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}

/** Bottom-sheet style modal. */
export function BottomSheet({ visible, onClose, title, children }: ModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="max-h-[85%] rounded-t-md bg-white p-4 dark:bg-gray-900"
          style={{ paddingBottom: insets.bottom + 16, marginBottom: keyboardHeight }}
          onPress={() => {}}
        >
          {title ? (
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <FontAwesome5 name="times" size={18} color={colors.iconMuted} />
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
        <Pressable className="w-full rounded-md bg-white p-5 dark:bg-gray-900" onPress={() => {}}>
          {title ? <Text className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
