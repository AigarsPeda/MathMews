import { moderateScale } from "@/utils/scale";
import { AppIcon } from "@/components/ui/AppIcon";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const ANIM_DURATION = 250;
const BODY_MARGIN = moderateScale(8);
const ANIM_EASING = Easing.out(Easing.cubic);

export type ExpandableProps = {
  header: ReactNode;
  children: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  /** Cap animated body height; enables scrolling when content is taller. */
  maxBodyHeight?: number;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  showChevron?: boolean;
};

export function Expandable({
  header,
  children,
  accessibilityLabel,
  style,
  headerStyle,
  maxBodyHeight,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  showChevron = true,
}: ExpandableProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const [contentHeight, setContentHeight] = useState(0);
  const progress = useSharedValue(defaultExpanded ? 1 : 0);

  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? expandedProp : internalExpanded;

  const expandedBodyHeight =
    maxBodyHeight !== undefined
      ? Math.min(contentHeight, maxBodyHeight)
      : contentHeight;

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: ANIM_DURATION,
      easing: ANIM_EASING,
    });
  }, [expanded, progress]);

  const handleMeasure = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight > 0) {
      setContentHeight(nextHeight);
    }
  }, []);

  const setExpanded = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalExpanded(next);
      }
      onExpandedChange?.(next);
    },
    [isControlled, onExpandedChange],
  );

  const toggle = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded, setExpanded]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    height: progress.value * expandedBodyHeight,
    opacity: progress.value,
    marginTop: progress.value * BODY_MARGIN,
    overflow: "hidden",
  }));

  const body =
    maxBodyHeight !== undefined ? (
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: maxBodyHeight }}
      >
        {children}
      </ScrollView>
    ) : (
      children
    );

  return (
    <View style={[styles.container, style]}>
      <Pressable
        onPress={toggle}
        style={[styles.header, headerStyle]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={accessibilityLabel}
      >
        <View style={styles.headerContent}>{header}</View>
        {showChevron ? (
          <Animated.View style={chevronStyle}>
            <AppIcon name="chevron-down" size={moderateScale(22)} />
          </Animated.View>
        ) : null}
      </Pressable>

      <View pointerEvents="none" style={styles.measure} onLayout={handleMeasure}>
        {children}
      </View>

      {contentHeight > 0 ? (
        <Animated.View style={bodyStyle}>{body}</Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(8),
    minHeight: moderateScale(36),
  },
  headerContent: {
    flex: 1,
  },
  measure: {
    position: "absolute",
    opacity: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },
});
