import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { useKitchen, CartItem } from '../../context/KitchenCoContext';
import { Ionicons } from '@expo/vector-icons';

export default function TrackerScreen() {
  const { orders, theme } = useKitchen();
  // Find the most recent active order (pending, preparing, or on_the_way) or fallback to most recent
  const currentOrder = orders.find(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'on_the_way') || orders[0] || null;

  if (!currentOrder) {
    return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>Order Status</Text>
            <Text style={styles.subtitle}>Track your current order</Text>
          </View>

          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="receipt-outline" size={48} color="#6B6B6B" />
            </View>
            <Text style={styles.emptyTitle}>No active order</Text>
            <Text style={styles.emptySubtitle}>
              When you place an order, you can track its preparation and delivery status here in real-time
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Status flow: pending -> preparing -> on_the_way -> delivered
  const statusFlow = ['pending', 'preparing', 'on_the_way', 'delivered'];
  const currentStatusIndex = statusFlow.indexOf(currentOrder.status);
  const isDelivered = currentOrder.status === 'delivered';

  const getTrackerHeader = () => {
    switch (currentOrder.status) {
      case 'pending':
        return { icon: 'time-outline', title: 'Received', sub: 'Waiting for the kitchen to accept...' };
      case 'preparing':
        return { icon: 'restaurant', title: 'In the Kitchen', sub: 'Estimated 15-20 mins' };
      case 'on_the_way':
        return { icon: 'bicycle', title: 'On the Way', sub: 'Your driver is on the way!' };
      case 'delivered':
        return { icon: 'checkmark-circle', title: 'Delivered', sub: 'Enjoy your meal!' };
      default:
        return { icon: 'restaurant', title: 'In the Kitchen', sub: 'Estimated 15-20 mins' };
    }
  };

  const trackerHeader = getTrackerHeader();

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStatusIndex) return 'completed';
    if (stepIndex === currentStatusIndex) return 'active';
    return 'inactive';
  };

  const getStepIcon = (stepIndex: number) => {
    const s = getStepStatus(stepIndex);
    if (s === 'completed') return 'checkmark';
    if (s === 'active') {
      switch (stepIndex) {
        case 0: return 'time';
        case 1: return 'restaurant';
        case 2: return 'bicycle';
        case 3: return 'checkmark-circle';
        default: return 'ellipse';
      }
    }
    return 'ellipse-outline';
  };

  const getProgressWidth = (): number => {
    if (currentStatusIndex <= 0) return 0;
    return ((currentStatusIndex) / (statusFlow.length - 1)) * 100;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>Order Status</Text>
          <Text style={styles.subtitle}>Order {currentOrder.id}</Text>
        </View>

        {/* Modern Order Tracker Card */}
        <View style={styles.trackerCard}>
          <View style={styles.trackerHeader}>
            <View style={[styles.trackerIconWrap, isDelivered && styles.trackerIconWrapDelivered]}>
              <Ionicons name={trackerHeader.icon as any} size={24} color="#000000" />
            </View>
            <View style={styles.trackerHeaderText}>
              <Text style={styles.trackerTitle}>{trackerHeader.title}</Text>
              <Text style={styles.trackerSub}>{trackerHeader.sub}</Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${getProgressWidth()}%` as any }, isDelivered && styles.progressFillDelivered]} />
            </View>
          </View>

          <View style={styles.stepsContainer}>
            {statusFlow.map((status, index) => {
              const stepStatus = getStepStatus(index);
              const isCompleted = stepStatus === 'completed';
              const isActive = stepStatus === 'active';
              const isInactive = stepStatus === 'inactive';
              return (
                <View key={status} style={[styles.step, (isCompleted || isActive) && styles.stepCompleted]}>
                  <View style={[styles.stepIconWrap, isActive && styles.stepActiveWrap, isCompleted && styles.stepCompletedWrap, isDelivered && index === statusFlow.length - 1 && styles.stepDeliveredWrap]}>
                    <Ionicons 
                      name={getStepIcon(index) as any} 
                      size={16} 
                      color={isInactive ? '#6B6B6B' : '#000000'} 
                    />
                  </View>
                  <Text style={[styles.stepLabel, isInactive && styles.stepLabelInactive]}>
                    {status === 'pending' ? 'Received' : status === 'on_the_way' ? 'On The Way' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Items Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Items</Text>
          <Text style={styles.sectionCount}>{currentOrder.items.length} items</Text>
        </View>

        <View style={styles.itemsContainer}>
          {currentOrder.items.map((item: CartItem, idx: number) => (
            <View key={item.id || idx} style={styles.itemCard}>
              <View style={styles.itemIconWrap}>
                <Text style={styles.itemEmoji}>🍽️</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.selectedSize && (
                  <Text style={styles.itemMeta}>{item.selectedSize}</Text>
                )}
                {item.category && !item.selectedSize && (
                  <Text style={styles.itemMeta}>{item.category}</Text>
                )}
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
                <Text style={styles.itemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>R {currentOrder.total.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={[styles.summaryValue, styles.summaryFree]}>Free</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>R {currentOrder.total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' }, // Fallback, theme applied inline
  scrollContent: { padding: 16, paddingBottom: 32 },
  
  headerSection: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  trackerIconWrapDelivered: { backgroundColor: '#22C55E' },
  progressFillDelivered: { backgroundColor: '#22C55E' },
  stepActiveWrap: { backgroundColor: '#5AC8FA' },
  stepCompletedWrap: { backgroundColor: '#22C55E' },
  stepDeliveredWrap: { backgroundColor: '#22C55E' },
  
  emptyCard: { 
    backgroundColor: '#1A1A1A', 
    borderWidth: 1,
    borderColor: '#2C2C2E', 
    borderRadius: 24, 
    padding: 40, 
    alignItems: 'center',
    marginTop: 40,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyIconWrap: { 
    width: 90, 
    height: 90, 
    borderRadius: 45, 
    backgroundColor: '#1E1E1E', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginTop: 16, marginBottom: 8, letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  
  // Tracker Card
  trackerCard: { 
    backgroundColor: '#1A1A1A', 
    borderWidth: 1, 
    borderColor: '#2C2C2E', 
    borderRadius: 24, 
    padding: 24, 
    marginBottom: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  trackerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  trackerIconWrap: { 
    width: 52, 
    height: 52, 
    borderRadius: 26, 
    backgroundColor: '#FFFFFF', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  trackerHeaderText: { flex: 1 },
  trackerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 3, letterSpacing: -0.3 },
  trackerSub: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  
  progressContainer: { marginBottom: 28 },
  progressBar: { height: 8, backgroundColor: '#1E1E1E', borderRadius: 4, overflow: 'hidden' },
  progressFill: { width: '60%', height: '100%', backgroundColor: '#FFFFFF', borderRadius: 4, shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 },
  
  stepsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { alignItems: 'center', flex: 1 },
  stepCompleted: { opacity: 1 },
  stepActive: { opacity: 1 },
  stepIconWrap: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#FFFFFF', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  stepLabel: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  stepLabelInactive: { color: '#6B6B6B' },
  
  // Section Headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
  
  // Items
  itemsContainer: { marginBottom: 20 },
  itemCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#1A1A1A', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  itemIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E1E1E', justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: '#2C2C2E' },
  itemEmoji: { fontSize: 20 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  itemMeta: { fontSize: 12, color: '#6B6B6B', fontWeight: '500' },
  itemRight: { alignItems: 'flex-end' },
  itemQty: { fontSize: 13, color: '#8E8E93', fontWeight: '600' },
  itemPrice: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  
  // Summary
  summaryCard: { 
    backgroundColor: '#1A1A1A', 
    borderWidth: 1, 
    borderColor: '#2C2C2E', 
    borderRadius: 20, 
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  summaryValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', letterSpacing: -0.2 },
  summaryFree: { color: '#00C853', fontWeight: '700' },
  summaryDivider: { height: 1, backgroundColor: '#2C2C2E', marginVertical: 14 },
  summaryTotalLabel: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  summaryTotalValue: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.4 },
});