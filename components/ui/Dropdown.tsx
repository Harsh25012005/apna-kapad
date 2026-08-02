import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from './Toast';
import { VoiceListeningOverlay } from './VoiceListeningOverlay';

export type DropdownOption<T extends string = string> = { label: string; value: T };

export type DropdownProps<T extends string = string> = {
  label?: string;
  value: T | '';
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  error?: string;
  /** Shows a search field (with voice search) at the top of the option sheet. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shows an "add new" row in the sheet; tapping it closes the sheet and fires this. */
  onAddNew?: () => void;
  addNewLabel?: string;
  /** Shows a red "*" next to the label to mark the field as mandatory. */
  required?: boolean;
};

export function Dropdown<T extends string = string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  searchable = false,
  searchPlaceholder,
  onAddNew,
  addNewLabel,
  required = false,
}: DropdownProps<T>) {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const showToast = useToast();
  const insets = useSafeAreaInsets();
  const placeholderText = placeholder ?? t('fields.select');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dictating, setDictating] = useState(false);
  const selected = options.find((o) => o.value === value);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) setQuery(transcript);
  });
  useSpeechRecognitionEvent('end', () => setDictating(false));
  useSpeechRecognitionEvent('error', () => {
    setDictating(false);
    showToast(t('fields.dictationFailed'), 'error');
  });

  const startDictation = async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      showToast(t('fields.microphonePermissionDenied'), 'error');
      return;
    }
    setDictating(true);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false, continuous: false });
  };

  const stopDictation = () => ExpoSpeechRecognitionModule.stop();

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const closeSheet = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View className="w-full mb-4">
      {label ? (
        <Text className="mb-1.5 text-base font-semibold text-gray-600 dark:text-gray-400">
          {label}
          {required ? <Text className="text-danger normal-case tracking-normal"> *</Text> : null}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        className={`h-[52px] flex-row items-center justify-between rounded-md border bg-gray-50 px-4 dark:bg-gray-800 ${
          error ? 'border-danger' : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <Text className={selected ? 'text-base text-gray-900 dark:text-gray-50' : 'text-base text-gray-400 dark:text-gray-500'}>
          {selected ? selected.label : placeholderText}
        </Text>
        <FontAwesome5 name="chevron-down" size={12} color={colors.iconMuted} />
      </Pressable>

      {error ? <Text className="mt-1.5 text-base font-medium text-danger">{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeSheet}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={closeSheet}>
          <Pressable
            className="max-h-[70%] rounded-t-md bg-white p-4 dark:bg-gray-900"
            style={{ paddingBottom: insets.bottom + 16 }}
            onPress={() => {}}
          >
            {label ? (
              <Text className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-50">{label}</Text>
            ) : null}

            {searchable ? (
              <View className="mb-3 flex-row items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-800">
                <FontAwesome5 name="search" size={13} color={colors.iconMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder ?? t('fields.search')}
                  placeholderTextColor={colors.textFaint}
                  className="font-sans h-11 flex-1 text-base text-gray-900 dark:text-gray-50"
                />
                <Pressable
                  onPress={() => (dictating ? stopDictation() : startDictation())}
                  hitSlop={8}
                  className={`h-8 w-8 items-center justify-center rounded-full ${
                    dictating ? 'bg-danger' : 'bg-primary-50 dark:bg-primary-950'
                  }`}
                >
                  <FontAwesome5 name="microphone" size={13} color={dictating ? '#FFFFFF' : colors.primary} />
                </Pressable>
              </View>
            ) : null}

            {onAddNew ? (
              <Pressable
                onPress={() => {
                  closeSheet();
                  onAddNew();
                }}
                className="mb-2 flex-row items-center gap-2 rounded-md bg-primary-50 px-3 py-3 dark:bg-primary-950"
              >
                <FontAwesome5 name="plus-circle" size={14} color={colors.primary} />
                <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">
                  {addNewLabel ?? t('fields.addNew')}
                </Text>
              </Pressable>
            ) : null}

            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    closeSheet();
                  }}
                  className="flex-row items-center justify-between py-3"
                >
                  <Text className="font-sans text-base text-gray-800 dark:text-gray-200">{item.label}</Text>
                  {item.value === value ? (
                    <FontAwesome5 name="check" size={14} color={colors.primary} />
                  ) : null}
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View className="h-px bg-gray-100 dark:bg-gray-800" />}
              ListEmptyComponent={
                <Text className="font-sans py-3 text-base text-gray-400 dark:text-gray-500">{t('fields.noOptions')}</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      <VoiceListeningOverlay
        visible={dictating}
        onStop={stopDictation}
        label={t('fields.listening')}
        hint={t('fields.listeningHint')}
      />
    </View>
  );
}
