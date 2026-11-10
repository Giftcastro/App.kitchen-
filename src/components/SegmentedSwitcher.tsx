import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export type AuthMode = 'sign_in' | 'first_time';

interface SegmentedSwitcherProps {
  activeMode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}

export const SegmentedSwitcher: React.FC<SegmentedSwitcherProps> = ({
  activeMode,
  onModeChange,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.surfaceBorder,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onModeChange('sign_in')}
        style={[
          styles.segment,
          activeMode === 'sign_in' && [
            styles.activeSegment,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.surfaceBorderLight,
            },
          ],
        ]}
      >
        <Text
          style={[
            styles.segmentText,
            { color: theme.textSecondary },
            activeMode === 'sign_in' && [
              styles.activeSegmentText,
              { color: theme.textPrimary },
            ],
          ]}
        >
          Sign In
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onModeChange('first_time')}
        style={[
          styles.segment,
          activeMode === 'first_time' && [
            styles.activeSegment,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.surfaceBorderLight,
            },
          ],
        ]}
      >
        <Text
          style={[
            styles.segmentText,
            { color: theme.textSecondary },
            activeMode === 'first_time' && [
              styles.activeSegmentText,
              { color: theme.textPrimary },
            ],
          ]}
        >
          First-Time Access
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    marginVertical: 14,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  activeSegment: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeSegmentText: {
    fontWeight: '700',
  },
});
