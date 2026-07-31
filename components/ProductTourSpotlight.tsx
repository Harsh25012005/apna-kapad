import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MENU_LAYOUT } from './QuickAddMenu';
import { TOUR_STEPS, type TourStep } from '../context/ProductTourContext';

const { H_MARGIN, HEADER_H, ROW_H, FOOT_H } = MENU_LAYOUT;

export type ProductTourSpotlightProps = {
  step: TourStep;
  actionCount: number;
  /** Distance from the screen bottom to the quick-add sheet's bottom edge. */
  bottomOffset: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onTryItNow: () => void;
};

/**
 * Renders above the (forced-open) QuickAddMenu during the tour: a tooltip
 * card pointing at the currently spotlit row, positioned by the same row
 * geometry the menu itself uses, so no measuring/refs are needed.
 */
export function ProductTourSpotlight({
  step,
  actionCount,
  bottomOffset,
  onBack,
  onNext,
  onSkip,
  onTryItNow,
}: ProductTourSpotlightProps) {
  const { t } = useTranslation('settings');
  const { height: screenH } = useWindowDimensions();

  const index = TOUR_STEPS.indexOf(step);
  const isLast = index === TOUR_STEPS.length - 1;
  const cardH = HEADER_H + actionCount * ROW_H + FOOT_H;
  const sheetTop = screenH - bottomOffset - cardH;
  const rowTop = sheetTop + HEADER_H + index * ROW_H;
  const rowCenterY = rowTop + ROW_H / 2;

  // Tooltip sits just above the row it's pointing at, right-aligned to the
  // sheet's inner edge, and never crowds above the status bar.
  const tooltipBottom = Math.max(screenH - rowCenterY + 34, screenH - sheetTop + 8);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: screenH }}>
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: H_MARGIN, right: H_MARGIN, bottom: tooltipBottom }}
      >
        <View className="rounded-2xl border border-white/10 bg-gray-900 p-4 shadow-lg">
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row gap-1.5">
              {TOUR_STEPS.map((s, i) => (
                <View
                  key={s}
                  className="h-1 rounded-full"
                  style={{ width: 20, backgroundColor: i <= index ? '#2563EB' : 'rgba(255,255,255,0.18)' }}
                />
              ))}
            </View>
            <Pressable onPress={onSkip} hitSlop={8}>
              <Text className="text-sm font-medium text-gray-400">{t('appGuide.skip')}</Text>
            </Pressable>
          </View>

          <Text className="mb-1 text-base font-bold text-white">{t(`appGuide.steps.${step}.title`)}</Text>
          <Text className="mb-4 text-sm leading-5 text-gray-300">
            {t(`appGuide.steps.${step}.description`)}
          </Text>

          <View className="flex-row items-center gap-2">
            {index > 0 ? (
              <Pressable
                onPress={onBack}
                className="rounded-full border border-white/15 px-4 py-2.5 active:bg-white/5"
              >
                <Text className="text-sm font-semibold text-gray-200">{t('appGuide.back')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onTryItNow}
              className="flex-1 rounded-full border border-white/15 px-4 py-2.5 active:bg-white/5"
            >
              <Text className="text-center text-sm font-semibold text-gray-200">{t('appGuide.tryItNow')}</Text>
            </Pressable>
            <Pressable onPress={onNext} className="flex-1 rounded-full bg-primary-500 px-4 py-2.5 active:bg-primary-600">
              <Text className="text-center text-sm font-semibold text-white">
                {isLast ? t('appGuide.getStarted') : t('appGuide.next')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
