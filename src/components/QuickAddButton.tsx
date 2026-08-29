import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

interface QuickAddButtonProps {
  quantity: number;
  onPress: () => void;
  disabled?: boolean;
  activeColor?: string;
}

export const QuickAddButton: React.FC<QuickAddButtonProps> = ({
  quantity,
  onPress,
  disabled,
  activeColor = '#000000',
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Pressable onPress={handlePress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Animated.View
        style={[
          styles.btn,
          quantity > 0 && { backgroundColor: activeColor },
          disabled && styles.btnDisabled,
          { transform: [{ scale }] },
        ]}
      >
        <Text style={[styles.text, quantity > 0 && styles.textActive]}>{disabled ? '🔒' : quantity > 0 ? String(quantity) : '+'}</Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  btnDisabled: { backgroundColor: '#EBEBEB' },
  text: { color: '#000000', fontSize: 16, fontWeight: '800', lineHeight: 20 },
  textActive: { color: '#FFFFFF' },
});
