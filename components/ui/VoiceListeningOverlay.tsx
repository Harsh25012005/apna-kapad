import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

export type VoiceListeningOverlayProps = {
  visible: boolean;
  /** Called when the user taps out — should stop the recognizer. */
  onStop: () => void;
  label: string;
  hint: string;
};

/**
 * Full-screen "Listening…" popup shown while voice dictation is active, so
 * tapping the mic gives clear feedback instead of the button just silently
 * turning red — a shop owner glancing at the phone mid-sentence should see
 * unmistakably that it's recording.
 */
export function VoiceListeningOverlay({ visible, onStop, label, hint }: VoiceListeningOverlayProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [visible, pulse]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onStop}>
      <Pressable className="flex-1 items-center justify-center bg-black/60" onPress={onStop}>
        <View className="items-center gap-4 rounded-2xl bg-white px-10 py-8 dark:bg-gray-900">
          <Animated.View
            style={{ transform: [{ scale: pulse }] }}
            className="h-16 w-16 items-center justify-center rounded-full bg-danger"
          >
            <FontAwesome5 name="microphone" size={24} color="#FFFFFF" />
          </Animated.View>
          <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">{label}</Text>
          <Text className="font-sans text-base text-gray-500 dark:text-gray-400">{hint}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}
