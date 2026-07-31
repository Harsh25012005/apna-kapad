import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Path, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTabBarHighlight } from '../context/TabBarHighlightContext';
import { useTheme } from '../context/ThemeContext';
import { QuickAddMenu, NOTCH, notchCurve } from '../components/QuickAddMenu';
import { haptics } from '../lib/haptics';
import type { MainTabParamList } from './types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Array<{
  type: 'tab' | 'add';
  routeName?: keyof MainTabParamList;
  labelKey: string;
  icon?: { active: IconName; inactive: IconName };
}> = [
    {
      type: 'tab',
      routeName: 'DashboardTab',
      labelKey: 'nav.dashboard',
      icon: { active: 'home', inactive: 'home-outline' },
    },
    {
      type: 'tab',
      routeName: 'CustomersTab',
      labelKey: 'nav.customers',
      icon: { active: 'people', inactive: 'people-outline' },
    },
    { type: 'add', labelKey: 'nav.add' },
    {
      type: 'tab',
      routeName: 'OrdersTab',
      labelKey: 'nav.orders',
      icon: { active: 'shirt', inactive: 'shirt-outline' },
    },
    {
      type: 'tab',
      routeName: 'SettingsTab',
      labelKey: 'nav.settings',
      icon: { active: 'person', inactive: 'person-outline' },
    },
  ];

/**
 * The four Add-button actions. `tab`/`screen` describe where each one lives:
 * these forms sit inside a tab's inner stack, not on the tab navigator, so
 * they're reached with a nested navigate (see `jumpTo`).
 */
export const QUICK_ACTIONS: Array<{
  key: string;
  labelKey: string;
  icon: IconName;
  bg: string;
  fg: string;
  tab: keyof MainTabParamList;
  screen: string;
}> = [
    {
      key: 'client',
      labelKey: 'quickAdd.newClient',
      icon: 'person-add',
      bg: '#D4E7C5',
      fg: '#334B24',
      tab: 'CustomersTab',
      screen: 'CustomerForm',
    },
    {
      key: 'bill',
      labelKey: 'quickAdd.addBill',
      icon: 'swap-horizontal',
      bg: '#E2D4F8',
      fg: '#482D78',
      tab: 'DashboardTab',
      screen: 'BillForm',
    },
    {
      key: 'order',
      labelKey: 'quickAdd.addOrder',
      icon: 'calendar',
      bg: '#F7EBB2',
      fg: '#574A1A',
      tab: 'OrdersTab',
      screen: 'OrderForm',
    },
    {
      key: 'staff',
      labelKey: 'quickAdd.addStaff',
      icon: 'flag',
      bg: '#FAD5C5',
      fg: '#6B3224',
      tab: 'SettingsTab',
      screen: 'StaffForm',
    },
  ];

const TAB_ROOT_SCREENS: Record<string, string> = {
  DashboardTab: 'Dashboard',
  CustomersTab: 'CustomerList',
  OrdersTab: 'OrderList',
  SettingsTab: 'SettingsHome',
};

const ACTIVE = '#2563EB';
const INACTIVE = '#8A8A8A';
const FAB_SIZE = 54;

/**
 * Concave dip in the bar's top edge that the Add button nests into.
 * Mirrors the notch cut into the bottom of the QuickAddMenu card, so the two
 * line up around the same circle — see NOTCH in QuickAddMenu.
 */
function barPathWithNotch(w: number, h: number, cx: number) {
  const r = 18; // top corner radius
  // Travelling left-to-right along the top edge, dipping downward.
  return `
    M 0,${r}
    Q 0,0 ${r},0
    L ${cx - NOTCH.flare},0
    ${notchCurve(cx, 0, 1, 1)}
    L ${w - r},0
    Q ${w},0 ${w},${r}
    L ${w},${h}
    L 0,${h}
    Z
  `;
}

/** Springs the icon up slightly when its tab becomes active. */
function AnimatedTabIcon({
  name,
  color,
  focused,
}: {
  name: IconName;
  color: string;
  focused: boolean;
}) {
  const t = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(t, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 5,
      tension: 160,
    }).start();
  }, [focused, t]);

  return (
    <Animated.View
      style={{
        transform: [
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
        ],
      }}
    >
      <Ionicons name={name} size={22} color={color} />
    </Animated.View>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { highlightedTab, setTabBarHeight } = useTabBarHighlight();
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const { t } = useTranslation('common');
  const { scheme } = useTheme();
  // Pure black reads as a deliberate dark dock on a light page. In dark mode
  // the page itself goes near-black, so the bar needs to be a shade lighter
  // than the page (not pure black) or it visually disappears into it.
  const barFill = scheme === 'dark' ? '#1C2333' : '#050505';

  const navWidth = Dimensions.get('window').width;
  const barHeight = 78;
  const bottomPadding = insets.bottom || 10;
  const totalBarHeight = barHeight + bottomPadding;
  const centerX = navWidth / 2;

  // Drives the FAB's rotate-to-X transition.
  const fabT = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(fabT, {
      toValue: isAddMenuOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  }, [isAddMenuOpen, fabT]);

  const toggleAddMenu = () => {
    haptics.tap();
    setIsAddMenuOpen((prev) => !prev);
  };

  /**
   * The tab navigator's own param list only knows about the four tab routes,
   * so it can't type a nested `{ screen: ... }` jump into a tab's inner stack.
   */
  const jumpTo = (tab: keyof MainTabParamList, screen: string) =>
    (navigation as unknown as { navigate: (t: string, p?: object) => void }).navigate(tab, {
      screen,
    });

  return (
    <View
      pointerEvents="box-none"
      style={styles.wrapper}
      onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)}
    >
      <QuickAddMenu
        visible={isAddMenuOpen}
        onClose={() => setIsAddMenuOpen(false)}
        bottomOffset={totalBarHeight + 22}
        cardFill={barFill}
        actions={QUICK_ACTIONS.map((a) => ({
          ...a,
          label: t(a.labelKey),
          onPress: () => {
            setIsAddMenuOpen(false);
            haptics.tap();
            jumpTo(a.tab, a.screen);
          },
        }))}
      />

      <View style={{ width: navWidth, height: totalBarHeight }}>
        <Svg width={navWidth} height={totalBarHeight} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="notchGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={ACTIVE} stopOpacity={isAddMenuOpen ? 0.4 : 0.18} />
              <Stop offset="1" stopColor={ACTIVE} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d={barPathWithNotch(navWidth, totalBarHeight, centerX)} fill={barFill} />
          {/* Soft blue bloom sitting under the notch. */}
          <Ellipse cx={centerX} cy={NOTCH.depth + 14} rx={46} ry={22} fill="url(#notchGlow)" />
        </Svg>

        <View style={[styles.row, { height: barHeight }]}>
          {TAB_CONFIG.map((item) => {
            if (item.type === 'add') {
              return (
                <View key="add-slot" style={styles.tabItem}>
                  <Animated.View
                    style={[
                      styles.fab,
                      {
                        backgroundColor: ACTIVE,
                        transform: [
                          {
                            rotate: fabT.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '135deg'],
                            }),
                          },
                          {
                            scale: fabT.interpolate({
                              inputRange: [0, 0.5, 1],
                              outputRange: [1, 0.92, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Pressable
                      onPress={toggleAddMenu}
                      hitSlop={10}
                      style={styles.fabPress}
                      accessibilityRole="button"
                      accessibilityLabel={t('quickAdd.accessibilityLabel')}
                    >
                      <Ionicons name="add" size={30} color="#FFFFFF" />
                    </Pressable>
                  </Animated.View>

                  <Text
                    style={[
                      styles.tabLabel,
                      { color: isAddMenuOpen ? '#FFFFFF' : INACTIVE, marginTop: 14 },
                    ]}
                    className={isAddMenuOpen ? 'font-semibold' : 'font-medium'}
                    numberOfLines={1}
                  >
                    {t(item.labelKey)}
                  </Text>
                </View>
              );
            }

            const routeIndex = state.routes.findIndex((r) => r.name === item.routeName);
            const route = state.routes[routeIndex];
            if (!route) return null;

            const isFocused = state.index === routeIndex && !isAddMenuOpen;
            const isHighlighted = highlightedTab === item.routeName;

            const onPress = () => {
              if (isAddMenuOpen) setIsAddMenuOpen(false);
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) {
                haptics.tap();
                const rootScreen = TAB_ROOT_SCREENS[route.name];
                if (rootScreen) {
                  (navigation as any).navigate(route.name, {
                    screen: rootScreen,
                  });
                } else {
                  navigation.navigate(route.name);
                }
              }
            };

            const tint = isFocused || isHighlighted ? ACTIVE : INACTIVE;

            return (
              <Pressable key={route.key} onPress={onPress} style={styles.tabItem}>
                <AnimatedTabIcon
                  name={isFocused ? item.icon!.active : item.icon!.inactive}
                  color={tint}
                  focused={isFocused}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isFocused ? '#FFFFFF' : tint },
                  ]}
                  className={isFocused ? 'font-semibold' : 'font-medium'}
                  numberOfLines={1}
                >
                  {t(item.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifts the button up into the notch.
    marginTop: -64,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  fabPress: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Android pads text by the font's ascender/descender unless disabled,
   *  which silently makes each label taller than its lineHeight. */
  tabLabel: {
    fontSize: 12,
    lineHeight: 13,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',

  },
});
