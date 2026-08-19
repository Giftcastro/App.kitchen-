import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEstimatedDelivery } from '../utils/deliveryHelpers';

export const DeliveryEstimator: React.FC = () => {
  const [deliveryInfo, setDeliveryInfo] = useState(() => getEstimatedDelivery());

  useEffect(() => {
    const interval = setInterval(() => {
      setDeliveryInfo(getEstimatedDelivery());
    }, 30000); // Check and update local time state every 30s
    return () => clearInterval(interval);
  }, []);

  const { formattedDate, isAfterCutoff, minutesLeft } = deliveryInfo;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrapper}>
          <Ionicons name="bicycle" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.label}>ESTIMATED DELIVERY</Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
          <Text style={styles.subtext}>Guaranteed arrival before 11:00 AM</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Dynamic Urgency / Cutoff Alert Indicator */}
      {!isAfterCutoff && minutesLeft > 0 && minutesLeft <= 60 ? (
        <View style={[styles.badge, styles.urgentBadge]}>
          <Text style={styles.urgentBadgeText}>
            ⚠️ Order within {minutesLeft} mins to secure this slot!
          </Text>
        </View>
      ) : !isAfterCutoff ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Daily dispatch cutoff is 11:00 AM</Text>
        </View>
      ) : (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Passed 11 AM run. Next cycle active.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#111111', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1C1C1E', marginBottom: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 },
  header: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: { backgroundColor: '#FFFFFF', width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14, shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  headerTextContainer: { flex: 1 },
  label: { fontSize: 10, fontWeight: '800', color: '#8E8E93', letterSpacing: 1 },
  dateText: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', marginTop: 2, letterSpacing: -0.3 },
  subtext: { fontSize: 12, color: '#8E8E93', marginTop: 2, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#1C1C1E', marginVertical: 14 },
  badge: { backgroundColor: '#1A1A1A', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2C2C2E' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#8E8E93' },
  urgentBadge: { backgroundColor: '#2A1F00', borderColor: '#5A4600', borderWidth: 1 },
  urgentBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFD60A' }
});
