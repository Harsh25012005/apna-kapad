import { Modal, Pressable, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from './ui';
import { useTheme } from '../context/ThemeContext';
import { useProductTour } from '../context/ProductTourContext';

export function ProductTourWelcome() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const { step, next, finish } = useProductTour();

  return (
    <Modal visible={step === 'welcome'} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center bg-gray-900/70 px-6">
        <View className="w-full max-w-sm items-center rounded-3xl bg-white p-6 dark:bg-gray-900">
          <View
            className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950"
          >
            <FontAwesome5 name="route" size={24} color={colors.primary} />
          </View>
          <Text className="mb-1.5 text-center text-lg font-bold text-gray-900 dark:text-gray-50">
            {t('appGuide.welcome.title')}
          </Text>
          <Text className="mb-6 text-center text-base leading-5 text-gray-500 dark:text-gray-400">
            {t('appGuide.welcome.subtitle')}
          </Text>
          <Button title={t('appGuide.welcome.cta')} onPress={next} />
          <Pressable onPress={finish} hitSlop={8} className="mt-4">
            <Text className="text-base font-medium text-gray-400 dark:text-gray-500">{t('appGuide.skip')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
