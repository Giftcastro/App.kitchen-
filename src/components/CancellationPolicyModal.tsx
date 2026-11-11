import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

interface CancellationPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CancellationPolicyModal: React.FC<CancellationPolicyModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
          <View style={[styles.handleBar, { backgroundColor: theme.surfaceBorderLight }]} />

          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              Cancellation & Holiday Policy
            </Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* 1. 48-Hour Cutoff Policy */}
            <View style={[styles.policySection, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <View style={styles.iconHeading}>
                <Ionicons name="time" size={18} color={theme.goldWarning} />
                <Text style={[styles.heading, { color: theme.textPrimary }]}>Two-Business-Day Cutoff Rule</Text>
              </View>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                Kitchen Co. operates on a zero-food-waste, fresh-ingredient model. All corporate meal orders must be placed before 9:00 AM South Africa Standard Time (SAST) on the second business day before the delivery date (a Monday delivery closes on the previous Thursday).
              </Text>
            </View>

            {/* 2. Strict No-Refund Policy */}
            <View style={[styles.policySection, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <View style={styles.iconHeading}>
                <Ionicons name="alert-circle" size={18} color={theme.error} />
                <Text style={[styles.heading, { color: theme.textPrimary }]}>No Modifications or Refunds Past Cutoff</Text>
              </View>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                Once the 9:00 AM SAST cutoff deadline has elapsed, our culinary stations immediately batch, prep, and allocate premium ingredients. Orders cannot be canceled, rescheduled, or refunded past this window.
              </Text>
            </View>

            {/* 3. Statutory Public Holidays */}
            <View style={[styles.policySection, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <View style={styles.iconHeading}>
                <Ionicons name="calendar" size={18} color={theme.primary} />
                <Text style={[styles.heading, { color: theme.textPrimary }]}>South African Statutory Public Holidays</Text>
              </View>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                Central kitchens are closed on all official South African gazetted public holidays, including observed public holidays when a holiday falls on a Sunday. The 14-weekday calendar automatically locks these dates.
              </Text>
            </View>

            {/* 4. Drop-off Concierge Protocol */}
            <View style={[styles.policySection, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <View style={styles.iconHeading}>
                <Ionicons name="business" size={18} color={theme.success} />
                <Text style={[styles.heading, { color: theme.textPrimary }]}>Batch Drop-Off at 12:00 PM</Text>
              </View>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                All corporate meals arrive in insulated thermal carriers at 12:00 PM sharp to your company's assigned pantry drop-off floor.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onClose}
              style={[styles.closeModalBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.closeModalBtnText, { color: theme.onPrimary }]}>I Understand</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
    borderTopWidth: 1,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: 12,
  },
  policySection: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 6,
  },
  iconHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 14,
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  closeModalBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  closeModalBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
