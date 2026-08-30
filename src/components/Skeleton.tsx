import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { ThemeColors } from '../utils/theme';

interface SkeletonProps {
  theme: ThemeColors;
  style?: StyleProp<ViewStyle>;
}

/** A shimmering placeholder block — used while `useSimulatedLoad().isLoading` is true. */
export function Skeleton({ theme, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { backgroundColor: theme.surfaceSecondary, borderRadius: 10, opacity },
        style,
      ]}
    />
  );
}
