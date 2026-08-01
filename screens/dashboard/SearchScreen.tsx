import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import {
  Avatar,
  BottomSheet,
  Button,
  EmptyState,
  Header,
  QuickAddCustomerSheet,
  useToast,
  VoiceListeningOverlay,
} from '../../components/ui';
import { customersRepo } from '../../lib/data/repository';
import { useShop } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { DashboardScreenProps } from '../../navigation/types';
import type { Tables } from '../../lib/database.types';

type Customer = Tables<'customers'>;

export default function SearchScreen({ navigation }: DashboardScreenProps<'Search'>) {
  const { t } = useTranslation('dashboard');
  const shop = useShop();
  const showToast = useToast();
  const { colors } = useTheme();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [dictating, setDictating] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void customersRepo.list(shop.id).then(setCustomers);
    }, [shop.id])
  );

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) setQuery(transcript);
  });
  useSpeechRecognitionEvent('end', () => setDictating(false));
  useSpeechRecognitionEvent('error', () => {
    setDictating(false);
    showToast(t('search.dictationFailed'), 'error');
  });

  const startDictation = async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      showToast(t('search.microphonePermissionDenied'), 'error');
      return;
    }
    setDictating(true);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false, continuous: false });
  };
  const stopDictation = () => ExpoSpeechRecognitionModule.stop();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)
    );
  }, [customers, query]);

  const handleCreated = (customer: Customer) => {
    setQuickAddVisible(false);
    setCustomers((prev) => [...prev, customer]);
    setActiveCustomer(customer);
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <Header title={t('search.title')} onBack={() => navigation.goBack()} />

      <View className="flex-row items-center gap-2 px-5 pt-3">
        <View className="h-[48px] flex-1 flex-row items-center rounded-md border border-gray-200 bg-gray-50 px-4 dark:border-gray-700 dark:bg-gray-800">
          <FontAwesome5 name="search" size={14} color={colors.iconMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textFaint}
            autoFocus
            className="font-sans ml-3 flex-1 text-[15px] text-gray-900 dark:text-gray-50"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <FontAwesome5 name="times-circle" size={15} color={colors.iconMuted} solid />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => (dictating ? stopDictation() : startDictation())}
          hitSlop={8}
          className={`h-[48px] w-[48px] items-center justify-center rounded-full ${
            dictating ? 'bg-danger' : 'bg-primary-50 dark:bg-primary-950'
          }`}
        >
          <FontAwesome5 name="microphone" size={16} color={dictating ? '#FFFFFF' : colors.primary} />
        </Pressable>
      </View>

      {query.trim() === '' ? (
        <EmptyState
          icon="search"
          title={t('search.emptyPromptTitle')}
          description={t('search.emptyPromptDescription')}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon="user-plus"
          title={t('search.noResultsTitle')}
          description={t('search.noResultsDescription')}
          actionLabel={t('search.addClient')}
          onAction={() => setQuickAddVisible(true)}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 20, gap: 4 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActiveCustomer(item)}
              className="flex-row items-center gap-3 rounded-md px-2 py-3 active:bg-gray-50 dark:active:bg-gray-800"
            >
              <Avatar name={item.name} size="md" />
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-gray-50" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">
                  {item.phone || t('search.noPhone')}
                </Text>
              </View>
              <FontAwesome5 name="chevron-right" size={13} color={colors.iconMuted} />
            </Pressable>
          )}
        />
      )}

      <BottomSheet
        visible={!!activeCustomer}
        onClose={() => setActiveCustomer(null)}
        title={activeCustomer?.name}
      >
        <View className="gap-3">
          <Button
            title={t('search.createOrder')}
            onPress={() => {
              const customer = activeCustomer;
              setActiveCustomer(null);
              if (customer) navigation.navigate('OrderForm', { customerId: customer.id });
            }}
          />
          <Button
            title={t('search.viewProfile')}
            variant="secondary"
            onPress={() => {
              const customer = activeCustomer;
              setActiveCustomer(null);
              if (customer) {
                (navigation as any).navigate('CustomersTab', {
                  screen: 'CustomerDetail',
                  params: { customerId: customer.id },
                });
              }
            }}
          />
        </View>
      </BottomSheet>

      <QuickAddCustomerSheet
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
        onCreated={handleCreated}
      />

      <VoiceListeningOverlay
        visible={dictating}
        onStop={stopDictation}
        label={t('search.listening')}
        hint={t('search.listeningHint')}
      />
    </View>
  );
}
