import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Path, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useProductTour, TOUR_STEPS, type TourStep } from '../context/ProductTourContext';
import { QuickAddMenu, NOTCH, notchCurve } from '../components/QuickAddMenu';
import { ProductTourSpotlight } from '../components/ProductTourSpotlight';
import { haptics } from '../lib/haptics';
import type { MainTabParamList } from './types';

/** Maps a tour step to the quick-add action it should spotlight. */
const TOUR_STEP_TO_ACTION_KEY: Record<TourStep, string> = {
  customers: 'client',
  orders: 'order',
  billing: 'bill',
  staff: 'staff',
};

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

/**
 * Which quick-add screens are registered inside which tab's own stack (see
 * SharedOrderRoutes in navigation/types.ts). When the screen the user wants
 * already lives in the tab they're currently on, we push it onto that same
 * stack instead of switching tabs — so "Update"/"Save"/back returns them to
 * exactly the screen they tapped Add from, instead of stranding it on a
 * different tab's stack (the same class of bug fixed for the in-flow
 * "Add Client" escape hatches in OrderForm/BillForm).
 */
const LOCAL_SCREEN_AVAILABILITY: Partial<Record<keyof MainTabParamList, string[]>> = {
  DashboardTab: ['OrderForm', 'BillForm'],
  CustomersTab: ['OrderForm', 'BillForm', 'CustomerForm'],
  OrdersTab: ['OrderForm', 'BillForm'],
  SettingsTab: ['StaffForm'],
};

const ACTIVE = '#2563EB';
const INACTIVE = '#8A8A8A';
const FAB_SIZE = 54;

/**
 * The bottom bar only shows on the app's five main "browse" screens — Home,
 * Clients, Orders, Staff, and Billing lists. Every detail/form/nested screen
 * hides it, so drilling into a record doesn't keep a persistent nav bar
 * (and stray FAB) competing for space and taps on a screen that's meant to
 * be focused on one task.
 */
/**
 * Screens that hide the bottom bar — every add/edit form and every detail
 * page, which are focused single-task screens with their own back button.
 *
 * Deliberately a blacklist, not a whitelist: a tab's `route.state` is
 * undefined until its nested navigator has rendered at least once, so a
 * whitelist made the bar vanish on a tab's first visit (it saw "OrdersTab"
 * rather than "OrderList"). Defaulting to *visible* means an unrecognised
 * or not-yet-rendered screen keeps the bar instead of losing it.
 */
const TAB_BAR_HIDDEN_SCREENS = [
  // Add / edit forms
  'OrderForm',
  'CustomerForm',
  'MeasurementForm',
  'BillForm',
  'StaffForm',
  'StaffWorkEntryForm',
  'ShopEdit',
  // Detail pages
  'OrderDetail',
  'CustomerDetail',
  'BillDetail',
  'StaffDetail',
  'Revenue',
  // Staff list is reached from Business rather than being a tab of its own,
  // so it behaves like a nested page and hides the bar too.
  'Staff',
  // Full-screen focused tasks
  'Search',
];

/**
 * Drills into nested navigator state to find the name of the screen
 * actually on top, since `route.name` alone only ever gives the name of the
 * top-level tab/stack entry (e.g. "Billing"), not the real screen nested
 * inside it (e.g. "BillingList" vs "BillDetail").
 */
function getDeepestRouteName(route: { name: string; state?: { index?: number; routes: { name: string; state?: unknown }[] } }): string {
  if (!route.state) return route.name;
  const nested = route.state;
  const activeRoute = nested.routes[nested.index ?? nested.routes.length - 1];
  return getDeepestRouteName(activeRoute as typeof route);
}

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
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const { t } = useTranslation('common');
  const { scheme } = useTheme();
  const tour = useProductTour();
  const tourStep = TOUR_STEPS.includes(tour.step as TourStep) ? (tour.step as TourStep) : null;
  const menuOpen = isAddMenuOpen || tourStep !== null;
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
      toValue: menuOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  }, [menuOpen, fabT]);

  const toggleAddMenu = () => {
    if (tourStep) return;
    haptics.tap();
    setIsAddMenuOpen((prev) => !prev);
  };

  // Close the Add menu whenever the user actually navigates to a different
  // screen. We only watch `state.index` (which tab) and the innermost screen
  // name. Importantly we do NOT fire on the first render: React Navigation sets
  // `route.state` to undefined until the nested navigator renders once, which
  // would trigger an immediate close right after the FAB is tapped on a
  // fresh-mounted tab.
  const activeDeepest = getDeepestRouteName(state.routes[state.index] as never);
  const activeRouteKey = `${state.index}:${activeDeepest}`;
  const prevRouteKey = useRef(activeRouteKey);
  useEffect(() => {
    if (prevRouteKey.current !== activeRouteKey) {
      prevRouteKey.current = activeRouteKey;
      setIsAddMenuOpen(false);
    }
  });

  /**
   * The tab navigator's own param list only knows about the four tab routes,
   * so it can't type a nested `{ screen: ... }` jump into a tab's inner stack.
   */
  const jumpTo = (tab: keyof MainTabParamList, screen: string) =>
    (navigation as unknown as { navigate: (t: string, p?: object) => void }).navigate(tab, {
      screen,
    });

  /**
   * Prefers pushing the requested form onto the CURRENT tab's own stack
   * (preserving whatever screen the user was already on underneath) and only
   * falls back to switching tabs when that screen genuinely isn't reachable
   * from where the user is right now (e.g. "Add Order" while on Settings).
   */
  const openQuickAction = (tab: keyof MainTabParamList, screen: string) => {
    const currentTab = state.routes[state.index]?.name as keyof MainTabParamList | undefined;
    if (currentTab && LOCAL_SCREEN_AVAILABILITY[currentTab]?.includes(screen)) {
      jumpTo(currentTab, screen);
      return;
    }
    jumpTo(tab, screen);
  };

  // Tour stays visible regardless of screen (it drives its own navigation).
  if (!tourStep && TAB_BAR_HIDDEN_SCREENS.includes(activeDeepest)) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <QuickAddMenu
        visible={menuOpen}
        onClose={() => {
          if (tourStep) return;
          setIsAddMenuOpen(false);
        }}
        bottomOffset={totalBarHeight + 22}
        cardFill={barFill}
        highlightedKey={tourStep ? TOUR_STEP_TO_ACTION_KEY[tourStep] : undefined}
        actions={QUICK_ACTIONS.map((a) => ({
          ...a,
          label: t(a.labelKey),
          onPress: () => {
            if (tourStep) return;
            setIsAddMenuOpen(false);
            haptics.tap();
            openQuickAction(a.tab, a.screen);
          },
        }))}
      />

      {tourStep ? (
        <ProductTourSpotlight
          step={tourStep}
          actionCount={QUICK_ACTIONS.length}
          bottomOffset={totalBarHeight + 22}
          onBack={tour.back}
          onNext={tour.next}
          onSkip={tour.finish}
          onTryItNow={() => {
            const action = QUICK_ACTIONS.find((a) => a.key === TOUR_STEP_TO_ACTION_KEY[tourStep]);
            tour.finish();
            if (action) {
              haptics.tap();
              jumpTo(action.tab, action.screen);
            }
          }}
        />
      ) : null}

      <View style={{ width: navWidth, height: totalBarHeight }}>
        <Svg width={navWidth} height={totalBarHeight} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="notchGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={ACTIVE} stopOpacity={menuOpen ? 0.4 : 0.18} />
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
                      { color: menuOpen ? '#FFFFFF' : INACTIVE, marginTop: 14 },
                    ]}
                    className={menuOpen ? 'font-semibold' : 'font-medium'}
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

            const isFocused = state.index === routeIndex && !menuOpen;

            const onPress = () => {
              if (tourStep) return;
              if (isAddMenuOpen) setIsAddMenuOpen(false);
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) {
                haptics.tap();
                // Every tab press (whether re-tapping the current tab or
                // switching to a new one) always navigates to that tab's root
                // screen. This ensures that after opening a form via Quick Add
                // and going back, tapping the tab always shows the list screen
                // instead of the form that was last open there.
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

            const tint = isFocused ? ACTIVE : INACTIVE;

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
    fontSize: 14,
    lineHeight: 16,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
