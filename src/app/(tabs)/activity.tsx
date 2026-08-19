import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { useKitchen } from '../../context/KitchenCoContext';
import { useRouter } from 'expo-router';

export default function TabActivityScreen() {
  const { orders, addToCart } = useKitchen();
  const router = useRouter();

  const pastOrders = orders.slice(1); // Exclude current/latest order

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return '#FF9500';
      case 'preparing': return '#5AC8FA';
      case 'on_the_way': return '#22C55E';
      case 'delivered': return '#00C853';
      case 'cancelled': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'Received';
      case 'preparing': return 'Preparing';
      case 'on_the_way': return 'On The Way';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <View style={styles.header}>
        <Text style={styles.title}>Past Orders</Text>
        <Text style={styles.subtitle}>Your order history</Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>
            Start ordering delicious meals and they'll appear here
          </Text>
          <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/')}>
            <Text style={styles.menuBtnText}>Browse Menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={pastOrders.length > 0 ? pastOrders : orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyTitle}>No past orders yet</Text>
              <Text style={styles.emptySubtitle}>
                Your current order is active. Check back after completion
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusColor = getStatusColor(item.status);
            return (
              <TouchableOpacity style={styles.orderCard} activeOpacity={0.7}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderIdContainer}>
                    <Text style={styles.orderId}>{item.id}</Text>
                    <Text style={styles.orderDate}>{formatDate(item.timestamp)}</Text>
                  </View>
                  <View style={styles.orderTotalContainer}>
                    <Text style={styles.orderTotal}>R {item.total.toFixed(2)}</Text>
                    <View style={styles.itemCount}>
                      <Text style={styles.itemCountText}>
                        {item.items.reduce((sum, dish) => sum + dish.quantity, 0)} items
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.itemsPreview}>
                  {item.items.slice(0, 3).map((dish, idx) => (
                    <View key={dish.id || idx} style={styles.itemChip}>
                      <Text style={styles.itemChipText}>
                        {dish.quantity}x {dish.name}
                      </Text>
                    </View>
                  ))}
                  {item.items.length > 3 && (
                    <View style={styles.moreChip}>
                      <Text style={styles.moreChipText}>+{item.items.length - 3} more</Text>
                    </View>
                  )}
                </View>

                {/* Delivery Address */}
                {item.deliveryAddress && (
                  <View style={styles.addressSection}>
                    <View style={styles.addressIconWrap}>
                      <Text style={styles.addressIcon}>📍</Text>
                    </View>
                    <View style={styles.addressDetails}>
                      <Text style={styles.addressLabel}>{item.deliveryAddress.label}</Text>
                      <Text style={styles.addressText}>
                        {item.deliveryAddress.street}, {item.deliveryAddress.suburb}
                      </Text>
                      <Text style={styles.addressText}>
                        {item.deliveryAddress.city}, {item.deliveryAddress.code}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.orderFooter}>
                  <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{getStatusLabel(item.status)}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.reorderBtn}
                    onPress={() => {
                      // Add all items from this order to the cart
                      item.items.forEach(orderItem => {
                        addToCart({
                          id: orderItem.id,
                          name: orderItem.name,
                          price: orderItem.price,
                          category: orderItem.category,
                          quantity: orderItem.quantity,
                          image: orderItem.image,
                          selectedSize: orderItem.selectedSize,
                          notes: orderItem.notes,
                        });
                      });
                      router.push('/');
                    }}
                  >
                    <Text style={styles.reorderBtnText}>Reorder</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { padding: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  menuBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  menuBtnText: { color: '#000000', fontWeight: '800', fontSize: 15 },
  
  list: { padding: 16, paddingBottom: 20 },
  
  orderCard: { 
    backgroundColor: '#1A1A1A', 
    borderWidth: 1, 
    borderColor: '#2C2C2E', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  orderIdContainer: { flex: 1 },
  orderId: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 4, letterSpacing: -0.3 },
  orderDate: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  orderTotalContainer: { alignItems: 'flex-end' },
  orderTotal: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 4, letterSpacing: -0.3 },
  itemCount: { backgroundColor: '#1E1E1E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#2C2C2E' },
  itemCountText: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  
  itemsPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  itemChip: { 
    backgroundColor: '#1E1E1E', 
    paddingHorizontal: 12, 
    paddingVertical: 7, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E'
  },
  itemChipText: { fontSize: 12, color: '#A0A0A0', fontWeight: '500' },
  moreChip: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  moreChipText: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },

  // Address Section
  addressSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  addressIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  addressIcon: { fontSize: 18 },
  addressDetails: { flex: 1 },
  addressLabel: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginBottom: 3 },
  addressText: { fontSize: 12, color: '#8E8E93', fontWeight: '500', lineHeight: 16 },
  
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2C2C2E' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#2C2C2E' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00C853', marginRight: 6 },
  statusText: { fontSize: 12, color: '#FFFFFF', fontWeight: '700', textTransform: 'capitalize' },
  reorderBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  reorderBtnText: { color: '#000000', fontSize: 13, fontWeight: '800' },
});