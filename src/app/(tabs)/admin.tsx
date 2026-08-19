import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, TextInput, Modal, Dimensions, Alert } from 'react-native';
import { useKitchen, Order, AppUser } from '../../context/KitchenCoContext';
import { Ionicons } from '@expo/vector-icons';
import staticMenuData from '../../data/staticMenu.json';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9500',
  preparing: '#5AC8FA',
  on_the_way: '#22C55E',
  delivered: '#6B6B6B',
  cancelled: '#FF453A',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Received',
  preparing: 'Preparing',
  on_the_way: 'On The Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

type TabType = 'dashboard' | 'users' | 'orders' | 'weeks' | 'meals' | 'discounts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_ICONS: Record<TabType, string> = {
  dashboard: 'speedometer',
  users: 'people',
  orders: 'receipt',
  weeks: 'calendar',
  meals: 'restaurant',
  discounts: 'pricetag',
};

export default function AdminScreen() {
  const { orders, activeWeek, setActiveWeek, allUsers, discounts, addDiscount, updateDiscount, deleteDiscount, deleteUser, addUser } = useKitchen();
  const [selectedTab, setSelectedTab] = useState<TabType>('dashboard');
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountExpiry, setDiscountExpiry] = useState('');
  const [discountCompany, setDiscountCompany] = useState('');
  const [discountCategory, setDiscountCategory] = useState<string | null>(null);
  const [discountItem, setDiscountItem] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  // Stats
  const totalUsers = allUsers.length;
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const preparingOrders = orders.filter(o => o.status === 'preparing').length;
  const onTheWayOrders = orders.filter(o => o.status === 'on_the_way').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);

  const tabs: TabType[] = ['dashboard', 'users', 'orders', 'weeks', 'meals', 'discounts'];

  // Build categories from staticMenuData for discount targeting
  const categories = useMemo(() => {
    if (!staticMenuData || typeof staticMenuData !== 'object') return [];
    return Object.entries(staticMenuData)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, value]) => ({
        id: key,
        name: key,
        items: Array.isArray(value) ? value : [],
      }));
  }, []);

  const handleAddDiscount = () => {
    if (discountCode && discountPercent) {
      addDiscount({
        id: '',
        code: discountCode,
        percentage: parseInt(discountPercent),
        active: true,
        expires: discountExpiry || undefined,
        company: discountCompany || undefined,
        categoryId: discountCategory || undefined,
        itemName: discountItem || undefined,
      });
      setDiscountCode('');
      setDiscountPercent('');
      setDiscountExpiry('');
      setDiscountCompany('');
      setDiscountCategory(null);
      setDiscountItem(null);
      setShowAddDiscount(false);
    }
  };

  const handleAddUser = () => {
    if (newUserName && newUserEmail) {
      const newUser: AppUser = {
        id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
        name: newUserName,
        email: newUserEmail,
        role: 'customer',
        joinedDate: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
        orderCount: 0,
      };
      addUser(newUser);
      setNewUserName('');
      setNewUserEmail('');
      setShowAddUser(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      {/* Modern Bottom Tab Style Navigation */}
      <View style={styles.tabBar}>
        {tabs.map((key) => {
          const isActive = selectedTab === key;
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setSelectedTab(key)}
              activeOpacity={0.7}
            >
              <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                <Ionicons 
                  name={TAB_ICONS[key] as any} 
                  size={isActive ? 20 : 18} 
                  color={isActive ? '#FFFFFF' : '#6B6B6B'} 
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {selectedTab === 'dashboard' && (
          <>
            {/* Header */}
            <View style={styles.pageHeader}>
              <Text style={styles.greeting}>Kitchen Dashboard</Text>
              <Text style={styles.greetingSub}>Your restaurant at a glance</Text>
            </View>

            {/* Stats Grid - Modern Cards */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: '#1A1A2E' }]}>
                <View style={styles.statIconRow}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#5AC8FA20' }]}>
                    <Ionicons name="people" size={20} color="#5AC8FA" />
                  </View>
                </View>
                <Text style={styles.statNumber}>{totalUsers}</Text>
                <Text style={styles.statLabel}>Total Users</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#1A2E1A' }]}>
                <View style={styles.statIconRow}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#22C55E20' }]}>
                    <Ionicons name="receipt" size={20} color="#22C55E" />
                  </View>
                </View>
                <Text style={styles.statNumber}>{totalOrders}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#2E1A1A' }]}>
                <View style={styles.statIconRow}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#FF950020' }]}>
                    <Ionicons name="time" size={20} color="#FF9500" />
                  </View>
                </View>
                <Text style={styles.statNumber}>{pendingOrders + preparingOrders}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#1A1A1A' }]}>
                <View style={styles.statIconRow}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#FFFFFF20' }]}>
                    <Ionicons name="cash" size={20} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={styles.statNumber}>R{revenue.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
            </View>

            {/* Order Status Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>Order Status Breakdown</Text>
              <View style={styles.breakdownContainer}>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#FF9500' }]} />
                    <Text style={styles.breakdownLabel}>Pending</Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View style={[styles.breakdownBarFill, { width: `${totalOrders > 0 ? (pendingOrders / totalOrders) * 100 : 0}%`, backgroundColor: '#FF9500' }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{pendingOrders}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#5AC8FA' }]} />
                    <Text style={styles.breakdownLabel}>Preparing</Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View style={[styles.breakdownBarFill, { width: `${totalOrders > 0 ? (preparingOrders / totalOrders) * 100 : 0}%`, backgroundColor: '#5AC8FA' }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{preparingOrders}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#22C55E' }]} />
                    <Text style={styles.breakdownLabel}>On The Way</Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View style={[styles.breakdownBarFill, { width: `${totalOrders > 0 ? (onTheWayOrders / totalOrders) * 100 : 0}%`, backgroundColor: '#22C55E' }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{onTheWayOrders}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#6B6B6B' }]} />
                    <Text style={styles.breakdownLabel}>Delivered</Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View style={[styles.breakdownBarFill, { width: `${totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 0}%`, backgroundColor: '#6B6B6B' }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{deliveredCount}</Text>
                </View>
              </View>
            </View>

            {/* Active Week Card */}
            <View style={styles.weekCard}>
              <View style={styles.weekCardLeft}>
                <View style={styles.weekCardIconWrap}>
                  <Ionicons name="calendar" size={24} color="#22C55E" />
                </View>
                <View>
                  <Text style={styles.weekCardLabel}>Active Menu Cycle</Text>
                  <Text style={styles.weekCardValue}>Week {activeWeek}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.weekCardBtn} onPress={() => setSelectedTab('weeks')}>
                <Text style={styles.weekCardBtnText}>Change</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Orders */}
            {orders.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <Text style={styles.sectionCardTitle}>Recent Orders</Text>
                  <TouchableOpacity onPress={() => setSelectedTab('orders')}>
                    <Text style={styles.seeAllText}>See All</Text>
                  </TouchableOpacity>
                </View>
                {orders.slice(0, 4).map((order, idx) => (
                  <View key={order.id} style={[styles.recentOrderItem, idx === 0 && { borderTopWidth: 0 }]}>
                    <View style={styles.recentOrderLeft}>
                      <View style={[styles.recentOrderStatusDot, { backgroundColor: STATUS_COLORS[order.status] || '#6B6B6B' }]} />
                      <View>
                        <Text style={styles.recentOrderId}>{order.id}</Text>
                        <Text style={styles.recentOrderUser}>{order.userName || 'Guest'}</Text>
                      </View>
                    </View>
                    <View style={styles.recentOrderRight}>
                      <Text style={styles.recentOrderTotal}>R{order.total.toFixed(2)}</Text>
                      <View style={[styles.recentStatusBadge, { backgroundColor: (STATUS_COLORS[order.status] || '#6B6B6B') + '20' }]}>
                        <Text style={[styles.recentStatusText, { color: STATUS_COLORS[order.status] || '#6B6B6B' }]}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {selectedTab === 'users' && (
          <>
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.greeting}>User Management</Text>
                <Text style={styles.greetingSub}>{allUsers.length} registered users</Text>
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddUser(true)}>
                <Ionicons name="add" size={22} color="#000000" />
              </TouchableOpacity>
            </View>
            {allUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="people-outline" size={40} color="#6B6B6B" />
                </View>
                <Text style={styles.emptyTitle}>No users yet</Text>
                <Text style={styles.emptySub}>Add users to get started</Text>
              </View>
            ) : (
              allUsers.map((user, idx) => (
                <View key={user.id} style={[styles.userCard, idx === 0 && { marginTop: 4 }]}>
                  <View style={[styles.userAvatar, { backgroundColor: user.role === 'admin' ? '#FFD60A30' : '#5AC8FA30' }]}>
                    <Text style={[styles.userAvatarText, { color: user.role === 'admin' ? '#FFD60A' : '#5AC8FA' }]}>
                      {(user.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>{user.name || 'Unknown'}</Text>
                      {user.role === 'admin' && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <Text style={styles.userMeta}>Joined {user.joinedDate} • {user.orderCount} orders</Text>
                  </View>
                  {user.role !== 'admin' && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteUser(user.id)}>
                      <Ionicons name="trash-outline" size={18} color="#FF453A" />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {selectedTab === 'orders' && (
          <OrdersSection orders={orders} />
        )}

        {selectedTab === 'weeks' && (
          <WeeksSection activeWeek={activeWeek} setActiveWeek={setActiveWeek} />
        )}

        {selectedTab === 'meals' && (
          <MealsSection />
        )}

        {selectedTab === 'discounts' && (
          <>
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.greeting}>Discount Codes</Text>
                <Text style={styles.greetingSub}>{discounts.length} active codes</Text>
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddDiscount(true)}>
                <Ionicons name="add" size={22} color="#000000" />
              </TouchableOpacity>
            </View>
            
            {discounts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="pricetag-outline" size={40} color="#6B6B6B" />
                </View>
                <Text style={styles.emptyTitle}>No discounts yet</Text>
                <Text style={styles.emptySub}>Create discount codes to promote your meals</Text>
              </View>
            ) : (
              discounts.map((discount, idx) => (
                <View key={discount.id} style={[styles.discountCard, idx === 0 && { marginTop: 4 }]}>
                  <View style={styles.discountTopRow}>
                    <View style={styles.discountCodeSection}>
                      <View style={styles.discountCodeTag}>
                        <Text style={styles.discountCodeText}>{discount.code}</Text>
                      </View>
                      <Text style={styles.discountPercent}>-{discount.percentage}% OFF</Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.discountToggle, discount.active && styles.discountToggleOn]}
                      onPress={() => updateDiscount(discount.id, { active: !discount.active })}
                    >
                      <View style={[styles.discountToggleCircle, discount.active && styles.discountToggleCircleOn]} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.discountBottomRow}>
                    {discount.expires ? (
                      <Text style={styles.discountExpiry}>Expires: {discount.expires}</Text>
                    ) : (
                      <Text style={styles.discountExpiry}>No expiry</Text>
                    )}
                    <TouchableOpacity onPress={() => deleteDiscount(discount.id)}>
                      <Ionicons name="trash-outline" size={16} color="#FF453A" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Add Discount Modal */}
      <Modal visible={showAddDiscount} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Discount</Text>
              <TouchableOpacity onPress={() => setShowAddDiscount(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Code (e.g. SAVE20)"
              placeholderTextColor="#6B6B6B"
              value={discountCode}
              onChangeText={setDiscountCode}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Percentage (e.g. 20)"
              placeholderTextColor="#6B6B6B"
              value={discountPercent}
              onChangeText={setDiscountPercent}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Company (optional)"
              placeholderTextColor="#6B6B6B"
              value={discountCompany}
              onChangeText={setDiscountCompany}
            />
            <Text style={styles.modalFieldLabel}>TARGET CATEGORY (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerRow}>
              <TouchableOpacity
                style={[styles.categoryPickerChip, discountCategory === null && styles.categoryPickerChipActive]}
                onPress={() => {
                  setDiscountCategory(null);
                  setDiscountItem(null);
                }}
              >
                <Text style={[styles.categoryPickerChipText, discountCategory === null && styles.categoryPickerChipTextActive]}>
                  All Categories
                </Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryPickerChip, discountCategory === cat.id && styles.categoryPickerChipActive]}
                  onPress={() => {
                    setDiscountCategory(cat.id);
                    setDiscountItem(null);
                  }}
                >
                  <Text style={[styles.categoryPickerChipText, discountCategory === cat.id && styles.categoryPickerChipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {discountCategory && (
              <>
                <Text style={styles.modalFieldLabel}>TARGET ITEM (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerRow}>
                  <TouchableOpacity
                    style={[styles.categoryPickerChip, discountItem === null && styles.categoryPickerChipActive]}
                    onPress={() => setDiscountItem(null)}
                  >
                    <Text style={[styles.categoryPickerChipText, discountItem === null && styles.categoryPickerChipTextActive]}>
                      All Items
                    </Text>
                  </TouchableOpacity>
                  {categories.find(c => c.id === discountCategory)?.items.map((item: any) => (
                    <TouchableOpacity
                      key={item.name}
                      style={[styles.categoryPickerChip, discountItem === item.name && styles.categoryPickerChipActive]}
                      onPress={() => setDiscountItem(item.name)}
                    >
                      <Text style={[styles.categoryPickerChipText, discountItem === item.name && styles.categoryPickerChipTextActive]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddDiscount(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddDiscount}>
                <Text style={styles.modalSaveText}>Add Discount</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add User Modal */}
      <Modal visible={showAddUser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add User</Text>
              <TouchableOpacity onPress={() => setShowAddUser(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Full Name"
              placeholderTextColor="#6B6B6B"
              value={newUserName}
              onChangeText={setNewUserName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Email Address"
              placeholderTextColor="#6B6B6B"
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddUser(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddUser}>
                <Text style={styles.modalSaveText}>Add User</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MealsSection() {
  const { addMenuItem, updateMenuItem, deleteMenuItem } = useKitchen();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ categoryId: string; itemId: string; name: string; price: string; description: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');

  // Build categories from staticMenuData
  const categories = useMemo(() => {
    if (!staticMenuData || typeof staticMenuData !== 'object') return [];
    return Object.entries(staticMenuData)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, value]) => ({
        id: key,
        name: key,
        items: Array.isArray(value) ? value : [],
      }));
  }, []);

  const selectedCategoryData = selectedCategory 
    ? categories.find(c => c.id === selectedCategory) 
    : null;

  const handleAddItem = () => {
    if (!newItemName.trim() || !newItemPrice.trim() || !newItemCategory.trim()) {
      Alert.alert('Missing Fields', 'Please fill in name, price, and category');
      return;
    }
    const priceNum = parseFloat(newItemPrice.replace(/[^\d.]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price');
      return;
    }
    addMenuItem(newItemCategory, {
      name: newItemName.trim(),
      price: priceNum,
      description: newItemDesc.trim() || `${newItemName.trim()} - Freshly prepared`,
    });
    setNewItemName('');
    setNewItemPrice('');
    setNewItemDesc('');
    setNewItemCategory('');
    setShowAddModal(false);
  };

  const handleEditItem = () => {
    if (!editingItem) return;
    if (!editingItem.name.trim() || !editingItem.price.trim()) {
      Alert.alert('Missing Fields', 'Please fill in name and price');
      return;
    }
    const priceNum = parseFloat(editingItem.price.replace(/[^\d.]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price');
      return;
    }
    updateMenuItem(editingItem.categoryId, editingItem.itemId, {
      name: editingItem.name.trim(),
      price: priceNum,
      description: editingItem.description.trim(),
    });
    setEditingItem(null);
    setShowEditModal(false);
  };

  const handleDeleteItem = (categoryId: string, itemId: string, itemName: string) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${itemName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteMenuItem(categoryId, itemId)
        },
      ]
    );
  };

  const openEditModal = (categoryId: string, item: any) => {
    setEditingItem({
      categoryId,
      itemId: item.id || `item-${Date.now()}`,
      name: item.name || '',
      price: String(item.price || ''),
      description: item.description || '',
    });
    setShowEditModal(true);
  };

  return (
    <>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.greeting}>Menu Management</Text>
          <Text style={styles.greetingSub}>
            {selectedCategoryData 
              ? `${selectedCategoryData.items.length} items in ${selectedCategoryData.name}`
              : `${categories.length} categories`
            }
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={22} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilterRow}>
        <TouchableOpacity
          style={[styles.categoryTab, selectedCategory === null && styles.categoryTabActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryTabText, selectedCategory === null && styles.categoryTabTextActive]}>
            All Categories
          </Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryTab, selectedCategory === cat.id && styles.categoryTabActive]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={[styles.categoryTabText, selectedCategory === cat.id && styles.categoryTabTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items List */}
      {categories.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="restaurant-outline" size={40} color="#6B6B6B" />
          </View>
          <Text style={styles.emptyTitle}>No menu items found</Text>
          <Text style={styles.emptySub}>Add your first menu item to get started</Text>
        </View>
      ) : (
        (selectedCategory ? [selectedCategoryData!].filter(Boolean) : categories).map(cat => (
          <View key={cat.id} style={styles.menuCategorySection}>
            <View style={styles.menuCategoryHeader}>
              <Text style={styles.menuCategoryTitle}>{cat.name}</Text>
              <Text style={styles.menuCategoryCount}>{cat.items.length} items</Text>
            </View>
            {cat.items.length === 0 ? (
              <View style={styles.menuEmptyItems}>
                <Text style={styles.menuEmptyItemsText}>No items in this category</Text>
              </View>
            ) : (
              cat.items.map((item: any, idx: number) => {
                const itemId = item.id || `menu-item-${cat.id}-${idx}`;
                const displayPrice = item.price 
                  ? `R${Number(item.price).toFixed(2)}` 
                  : (item.prices ? item.prices[0] : 'R0');
                return (
                  <View key={itemId} style={styles.menuItemCard}>
                    <View style={styles.menuItemInfo}>
                      <Text style={styles.menuItemName}>{item.name}</Text>
                      <Text style={styles.menuItemPrice}>{displayPrice}</Text>
                      {item.description ? (
                        <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                      ) : null}
                    </View>
                    <View style={styles.menuItemActions}>
                      <TouchableOpacity 
                        style={styles.menuEditBtn}
                        onPress={() => openEditModal(cat.id, { ...item, id: itemId })}
                      >
                        <Ionicons name="create-outline" size={18} color="#5AC8FA" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.menuDeleteBtn}
                        onPress={() => handleDeleteItem(cat.id, itemId, item.name)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF453A" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ))
      )}

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Menu Item</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Item Name *"
              placeholderTextColor="#6B6B6B"
              value={newItemName}
              onChangeText={setNewItemName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Price * (e.g. 80)"
              placeholderTextColor="#6B6B6B"
              value={newItemPrice}
              onChangeText={setNewItemPrice}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Description (optional)"
              placeholderTextColor="#6B6B6B"
              value={newItemDesc}
              onChangeText={setNewItemDesc}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.modalFieldLabel}>CATEGORY *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerRow}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryPickerChip, newItemCategory === cat.id && styles.categoryPickerChipActive]}
                  onPress={() => setNewItemCategory(cat.id)}
                >
                  <Text style={[styles.categoryPickerChipText, newItemCategory === cat.id && styles.categoryPickerChipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddItem}>
                <Text style={styles.modalSaveText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Item Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Menu Item</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setEditingItem(null); }}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            {editingItem && (
              <>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Item Name"
                  placeholderTextColor="#6B6B6B"
                  value={editingItem.name}
                  onChangeText={(val) => setEditingItem({...editingItem, name: val})}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Price (e.g. 80)"
                  placeholderTextColor="#6B6B6B"
                  value={editingItem.price}
                  onChangeText={(val) => setEditingItem({...editingItem, price: val})}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.modalInput, { minHeight: 80 }]}
                  placeholder="Description"
                  placeholderTextColor="#6B6B6B"
                  value={editingItem.description}
                  onChangeText={(val) => setEditingItem({...editingItem, description: val})}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowEditModal(false); setEditingItem(null); }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalSaveBtn} onPress={handleEditItem}>
                    <Text style={styles.modalSaveText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function OrdersSection({ orders }: { orders: Order[] }) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="receipt-outline" size={40} color="#6B6B6B" />
        </View>
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptySub}>Orders will appear here once placed</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.greeting}>All Orders</Text>
          <Text style={styles.greetingSub}>{orders.length} total orders</Text>
        </View>
      </View>
      {orders.map((order, idx) => {
        const isExpanded = expandedOrder === order.id;
        return (
          <TouchableOpacity
            key={order.id}
            style={[styles.orderCard, idx === 0 && { marginTop: 4 }]}
            onPress={() => setExpandedOrder(isExpanded ? null : order.id)}
            activeOpacity={0.7}
          >
            <View style={styles.orderCardHeader}>
              <View style={styles.orderCardLeft}>
                <Text style={styles.orderCardId}>{order.id}</Text>
                <Text style={styles.orderCardUser}>{order.userName || 'Guest'}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[order.status] || '#6B6B6B') + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[order.status] || '#6B6B6B' }]}>
                  {STATUS_LABELS[order.status] || order.status}
                </Text>
              </View>
            </View>
            
            <Text style={styles.orderCardDate}>{order.timestamp || order.date}</Text>
            
            {isExpanded && (
              <View style={styles.orderCardExpanded}>
                <View style={styles.orderDivider} />
                {order.items.map((dish) => (
                  <View key={dish.id} style={styles.orderDishRow}>
                    <Text style={styles.orderDishName}>
                      {dish.quantity}x {dish.name}
                      {dish.selectedSize ? <Text style={styles.orderDishSize}> — {dish.selectedSize}</Text> : null}
                    </Text>
                    <Text style={styles.orderDishPrice}>R{(dish.price * dish.quantity).toFixed(2)}</Text>
                  </View>
                ))}
                <View style={styles.orderDivider} />
                <View style={styles.orderTotalRow}>
                  <Text style={styles.orderTotalLabel}>Total</Text>
                  <Text style={styles.orderTotalValue}>R{order.total.toFixed(2)}</Text>
                </View>
                {order.deliveryAddress && (
                  <View style={styles.orderAddress}>
                    <Ionicons name="location-outline" size={14} color="#6B6B6B" />
                    <Text style={styles.orderAddressText}>
                      {order.deliveryAddress.street}, {order.deliveryAddress.suburb}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            <View style={styles.expandArrow}>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#6B6B6B" />
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

function WeeksSection({ activeWeek, setActiveWeek }: { activeWeek: number; setActiveWeek: (w: number) => void }) {
  const weeks = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.greeting}>Menu Cycles</Text>
          <Text style={styles.greetingSub}>Select which week is active</Text>
        </View>
      </View>
      
      <View style={styles.weeksGrid}>
        {weeks.map((week) => {
          const isActive = activeWeek === week;
          return (
            <TouchableOpacity
              key={week}
              style={[styles.weekGridCard, isActive && styles.weekGridCardActive]}
              onPress={() => setActiveWeek(week)}
              activeOpacity={0.7}
            >
              <Text style={[styles.weekGridNumber, isActive && styles.weekGridNumberActive]}>
                {week}
              </Text>
              <Text style={[styles.weekGridLabel, isActive && styles.weekGridLabelActive]}>
                Week {week}
              </Text>
              {isActive && (
                <View style={styles.weekGridCheck}>
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoIconWrap}>
          <Ionicons name="information-circle" size={22} color="#5AC8FA" />
        </View>
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Currently Active</Text>
          <Text style={styles.infoText}>
            Week <Text style={{ color: '#22C55E', fontWeight: '800' }}>{activeWeek}</Text> menu is being shown to customers
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },

  // Modern Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    gap: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  tabItemActive: {
    backgroundColor: '#2C2C2E',
  },
  tabIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconWrapActive: {
    backgroundColor: '#000000',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B6B6B',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },

  // Page Header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
  },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  statIconRow: { marginBottom: 16 },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 4,
  },

  // Section Card
  sectionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5AC8FA',
    marginBottom: 16,
  },

  // Breakdown
  breakdownContainer: { gap: 12 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 110,
    gap: 8,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  breakdownBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    width: 30,
    textAlign: 'right',
  },

  // Week Card
  weekCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  weekCardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#22C55E20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 3,
  },
  weekCardValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  weekCardBtn: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  weekCardBtnText: {
    color: '#5AC8FA',
    fontSize: 13,
    fontWeight: '700',
  },

  // Recent Orders
  recentOrderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  recentOrderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recentOrderStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recentOrderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recentOrderUser: {
    fontSize: 11,
    color: '#6B6B6B',
    marginTop: 1,
  },
  recentOrderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  recentOrderTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Users
  addBtn: {
    backgroundColor: '#22C55E',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: { flex: 1 },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  adminBadge: {
    backgroundColor: '#FFD60A30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#FFD60A',
    fontSize: 10,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  userMeta: {
    fontSize: 11,
    color: '#6B6B6B',
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FF453A20',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Orders
  orderCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    position: 'relative',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderCardLeft: { flex: 1 },
  orderCardId: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  orderCardUser: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 2,
  },
  orderCardDate: {
    fontSize: 11,
    color: '#6B6B6B',
    marginTop: 6,
  },
  orderCardExpanded: {
    marginTop: 12,
  },
  orderDivider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginVertical: 10,
  },
  orderDishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  orderDishName: {
    fontSize: 13,
    color: '#8E8E93',
    flex: 1,
    paddingRight: 8,
  },
  orderDishSize: {
    fontSize: 11,
    color: '#6B6B6B',
  },
  orderDishPrice: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotalLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  orderTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#22C55E',
  },
  orderAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  orderAddressText: {
    fontSize: 12,
    color: '#6B6B6B',
    flex: 1,
  },
  expandArrow: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Weeks
  weeksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  weekGridCard: {
    width: (SCREEN_WIDTH - 42) / 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    alignItems: 'center',
    position: 'relative',
    minHeight: 90,
    justifyContent: 'center',
  },
  weekGridCardActive: {
    borderColor: '#22C55E',
    backgroundColor: '#0F1F0F',
  },
  weekGridNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  weekGridNumberActive: {
    color: '#22C55E',
  },
  weekGridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6B6B',
    marginTop: 4,
  },
  weekGridLabelActive: {
    color: '#22C55E',
  },
  weekGridCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#121926',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A2A3A',
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#5AC8FA20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: { flex: 1 },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  infoText: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 18,
  },

  // Category Tabs
  categoryTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryTab: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  categoryTabActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
  },
  categoryTabTextActive: {
    color: '#000000',
  },

  // Discounts
  discountCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  discountTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountCodeSection: {
    flex: 1,
  },
  discountCodeTag: {
    backgroundColor: '#22C55E20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  discountCodeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#22C55E',
    letterSpacing: 1,
  },
  discountPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  discountToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  discountToggleOn: {
    backgroundColor: '#22C55E',
    alignItems: 'flex-end',
  },
  discountToggleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  discountToggleCircleOn: {
    backgroundColor: '#FFFFFF',
  },
  discountBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  discountExpiry: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '500',
  },

  // Menu Management Styles
  categoryFilterRow: {
    marginBottom: 20,
  },
  menuCategorySection: {
    marginBottom: 20,
  },
  menuCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  menuCategoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  menuCategoryCount: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '600',
  },
  menuEmptyItems: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  menuEmptyItemsText: {
    color: '#6B6B6B',
    fontSize: 13,
    fontWeight: '500',
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  menuItemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#22C55E',
    marginBottom: 4,
  },
  menuItemDesc: {
    fontSize: 11,
    color: '#6B6B6B',
    lineHeight: 15,
  },
  menuItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  menuEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#5AC8FA20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FF453A20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B6B6B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  categoryPickerRow: {
    marginBottom: 16,
  },
  categoryPickerChip: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginRight: 8,
  },
  categoryPickerChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  categoryPickerChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
  },
  categoryPickerChipTextActive: {
    color: '#000000',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  modalInput: {
    backgroundColor: '#0C0C0C',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    fontSize: 15,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalCancelText: {
    color: '#8E8E93',
    fontWeight: '700',
    fontSize: 14,
  },
  modalSaveBtn: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalSaveText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
  },
});