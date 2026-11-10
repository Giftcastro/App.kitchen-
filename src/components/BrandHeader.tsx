import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BrandLogo } from './BrandLogo';

interface BrandHeaderProps {
  compact?: boolean;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({ compact = false }) => {
  return (
    <View style={[styles.container, compact ? styles.compactContainer : styles.standardContainer]}>
      <BrandLogo variant={compact ? 'standard' : 'large'} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardContainer: {
    marginTop: 28,
    marginBottom: 26,
  },
  compactContainer: {
    marginVertical: 10,
  },
});
