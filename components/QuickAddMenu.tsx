import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Shared geometry for the circular cut-out that the Add button nests into.
 * The nav bar dips *down* into its top edge and this card dips *up* into its
 * bottom edge using the same numbers, so the two curves meet cleanly around
 * the same circle.
 */
export const NOTCH = {
  /** Half-width where the curve rejoins the straight edge. */
  flare: 52,
  /** How far the curve travels from the edge. */
  depth: 24,
};

/**
 * Half of the notch, as a cubic. Control points are expressed as fractions of
 * `flare` so the scoop stays smooth and symmetric at any size — hand-picked
 * absolute control points made it read as an angular V rather than a cradle.
 * `dir` is 1 going right / -1 going left, `sign` is 1 dipping down (nav bar)
 * / -1 dipping up (menu card).
 */
export function notchCurve(cx: number, edgeY: number, dir: 1 | -1, sign: 1 | -1) {
  const { flare, depth } = NOTCH;
  const d = depth * sign;
  return (
    `C ${cx - dir * flare * 0.45},${edgeY} ${cx - dir * flare * 0.42},${edgeY + d} ${cx},${edgeY + d} ` +
    `C ${cx + dir * flare * 0.42},${edgeY + d} ${cx + dir * flare * 0.45},${edgeY} ${cx + dir * flare},${edgeY}`
  );
}

export type QuickAction = {
  key: string;
  label: string;
  icon: IconName;
  /** Pastel circle behind the icon. */
  bg: string;
  /** Icon tint, a deep shade of the same hue. */
  fg: string;
  onPress: () => void;
};

export type QuickAddMenuProps = {
  visible: boolean;
  onClose: () => void;
  actions: QuickAction[];
  /** Height of the nav bar, i.e. where this card's bottom edge should sit. */
  bottomOffset: number;
};

const OPEN_MS = 240;
const CLOSE_MS = 160;

const H_MARGIN = 12;
const HEADER_H = 40;
const ROW_H = 64;
/** Clear space under the last row so the notch never overlaps content. */
const FOOT_H = 34;
const CARD_RADIUS = 28;

/** Rounded rect with a concave notch cut into the bottom-centre edge. */
function cardPath(w: number, h: number) {
  const cx = w / 2;
  const r = CARD_RADIUS;
  // Travelling right-to-left along the bottom edge, dipping upward.
  return `
    M ${r},0
    L ${w - r},0
    Q ${w},0 ${w},${r}
    L ${w},${h - r}
    Q ${w},${h} ${w - r},${h}
    L ${cx + NOTCH.flare},${h}
    ${notchCurve(cx, h, -1, -1)}
    L ${r},${h}
    Q 0,${h} 0,${h - r}
    L 0,${r}
    Q 0,0 ${r},0
    Z
  `;
}

/**
 * The Add button's action sheet. Uses React Native's built-in Animated
 * (never Reanimated) — Reanimated worklets segfault inside Expo Go, and this
 * needs to stay usable there.
 */
export function QuickAddMenu({ visible, onClose, actions, bottomOffset }: QuickAddMenuProps) {
  // Kept mounted for the duration of the exit animation.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  // Reactive, unlike Dimensions.get('window') which is captured once at
  // mount and goes stale if the viewport resizes (web resize, rotation).
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cardW = screenW - H_MARGIN * 2;
  // Derived rather than measured, so the SVG can be drawn on the first frame
  // instead of flashing an unpainted card while onLayout resolves.
  const cardH = HEADER_H + actions.length * ROW_H + FOOT_H;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress]);

  if (!mounted) return null;

  return (
    <>
      {/* This renders inside the tab bar's wrapper, which is anchored to the
          screen bottom and has no height of its own — so absoluteFill would
          collapse to nothing. An explicit window-height box anchored at
          bottom:0 stretches back up over the whole screen instead. */}
      <Animated.View style={[styles.scrim, { height: screenH, opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            left: H_MARGIN,
            width: cardW,
            height: cardH,
            // Overlap the bar slightly so the two notch curves join up.
            bottom: bottomOffset - 2,
            opacity: progress,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
            ],
          },
        ]}
      >
        <Svg width={cardW} height={cardH} style={StyleSheet.absoluteFill}>
          <Path d={cardPath(cardW, cardH)} fill="#050505" />
        </Svg>

        <View style={[styles.grabber, { top: 12 }]} />

        <View style={{ marginTop: HEADER_H }}>
          {actions.map((action, i) => {
            // Single driver, offset per row, gives a staggered slide-in.
            const start = i * 0.1;
            const range = {
              inputRange: [start, Math.min(start + 0.55, 1)],
              extrapolate: 'clamp' as const,
            };

            return (
              <Animated.View
                key={action.key}
                style={{
                  opacity: progress.interpolate({ ...range, outputRange: [0, 1] }),
                  transform: [
                    { translateY: progress.interpolate({ ...range, outputRange: [14, 0] }) },
                  ],
                }}
              >
                {/* Static style, not the `({ pressed }) => ...` function form:
                    NativeWind wraps Pressable and drops function styles, which
                    silently left the row with no flexDirection or padding. */}
                <Pressable
                  onPress={action.onPress}
                  style={styles.row}
                  android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: action.bg }]}>
                    <Ionicons name={action.icon} size={20} color={action.fg} />
                  </View>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {action.label}
                  </Text>
                  <Ionicons name="add" size={20} color="rgba(255,255,255,0.22)" />
                </Pressable>
                {i < actions.length - 1 ? <View style={styles.divider} /> : null}
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    zIndex: 50,
  },
  grabber: {
    position: 'absolute',
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  row: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontFamily: 'GoogleSansFlex_500Medium',
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    backgroundColor: 'rgba(148,148,148,0.16)',
  },
});
