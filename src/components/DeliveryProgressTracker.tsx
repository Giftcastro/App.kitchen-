import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

interface DeliveryProgressTrackerProps {
  currentStage: 1 | 2 | 3 | 4;
  deliveryDateFormatted: string;
}

interface StepInfo {
  stage: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  timeHint: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STAGES: StepInfo[] = [
  {
    stage: 1,
    title: 'Payment Verified',
    subtitle: 'PayFast ITN webhook verified transaction and booked kitchen batch.',
    timeHint: 'Completed (Cutoff Passed)',
    icon: 'shield-checkmark',
  },
  {
    stage: 2,
    title: 'Kitchen Prepping',
    subtitle: 'Culinary team is preparing standardized fresh ingredients.',
    timeHint: 'Morning of Delivery (08:00 - 11:15 AM)',
    icon: 'restaurant',
  },
  {
    stage: 3,
    title: 'Out for Batch Drop',
    subtitle: 'Insulated thermal carriers dispatched to your corporate campus.',
    timeHint: 'En Route to Your Building (11:30 AM)',
    icon: 'car',
  },
  {
    stage: 4,
    title: 'Delivered to Pantry',
    subtitle: 'Batch securely placed in designated floor cooler pantry staging area.',
    timeHint: 'Arrives 12:00 PM Sharp',
    icon: 'business',
  },
];

export const DeliveryProgressTracker: React.FC<DeliveryProgressTrackerProps> = ({
  currentStage,
  deliveryDateFormatted,
}) => {
  const { theme } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the active stage
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.headerLabel, { color: theme.textSecondary }]}>BATCH DISPATCH PROGRESS</Text>
          <Text style={[styles.headerDate, { color: theme.primary }]}>{deliveryDateFormatted}</Text>
        </View>
        <View style={[styles.batchBadge, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}>
          <Text style={[styles.batchBadgeText, { color: theme.primary }]}>Batch #1200</Text>
        </View>
      </View>

      <View style={styles.stepsContainer}>
        {STAGES.map((step, index) => {
          const isCompleted = currentStage > step.stage;
          const isActive = currentStage === step.stage;
          const isUpcoming = currentStage < step.stage;
          const isLast = index === STAGES.length - 1;

          return (
            <View key={step.stage} style={styles.stepWrapper}>
              {/* Left Column: Node Icon & Connecting Line */}
              <View style={styles.nodeColumn}>
                {isActive ? (
                  <View style={styles.activeNodeContainer}>
                    <Animated.View
                      style={[
                        styles.pulseRing,
                        {
                          backgroundColor: theme.primaryGlow,
                          transform: [{ scale: pulseAnim }],
                        },
                      ]}
                    />
                    <View style={[styles.activeNode, { backgroundColor: theme.primary }]}>
                      <Ionicons name={step.icon} size={16} color={theme.onPrimary} />
                    </View>
                  </View>
                ) : isCompleted ? (
                  <View style={[styles.completedNode, { backgroundColor: theme.success }]}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.upcomingNode,
                      {
                        backgroundColor: theme.surfaceHighlight,
                        borderColor: theme.surfaceBorderLight,
                      },
                    ]}
                  >
                    <Ionicons name={step.icon} size={14} color={theme.textMuted} />
                  </View>
                )}

                {/* Connecting Line */}
                {!isLast && (
                  <View
                    style={[
                      styles.connectingLine,
                      {
                        backgroundColor: isCompleted ? theme.success : theme.surfaceBorder,
                      },
                    ]}
                  />
                )}
              </View>

              {/* Right Column: Title, Subtitle & Time hint */}
              <View style={[styles.contentColumn, !isLast && styles.contentSpacing]}>
                <View style={styles.stepTitleRow}>
                  <Text
                    style={[
                      styles.stepTitle,
                      { color: theme.textPrimary },
                      isActive && { color: theme.primary, fontWeight: '800' },
                      isUpcoming && { color: theme.textSecondary },
                    ]}
                  >
                    {step.title}
                  </Text>
                  <Text
                    style={[
                      styles.timeHint,
                      { color: isCompleted ? theme.success : isActive ? theme.primary : theme.textMuted },
                    ]}
                  >
                    {step.timeHint}
                  </Text>
                </View>

                <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
                  {step.subtitle}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerDate: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  batchBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  batchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stepsContainer: {
    paddingLeft: 4,
  },
  stepWrapper: {
    flexDirection: 'row',
  },
  nodeColumn: {
    alignItems: 'center',
    width: 36,
  },
  activeNodeContainer: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  activeNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  completedNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectingLine: {
    width: 2,
    flex: 1,
    minHeight: 38,
    marginVertical: 4,
  },
  contentColumn: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 4,
  },
  contentSpacing: {
    paddingBottom: 22,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  timeHint: {
    fontSize: 10,
    fontWeight: '700',
  },
  stepSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
});
