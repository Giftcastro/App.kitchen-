import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKitchen } from '../../context/KitchenCoContext';
import { TouchableOpacity, Text, View, StyleSheet, StatusBar } from 'react-native';

export default function TabsLayout() {
  const { user, cart, theme } = useKitchen();
  const router = useRouter();

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textTertiary,
          tabBarStyle: {
            backgroundColor: theme.tabBar,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          headerStyle: {
            backgroundColor: theme.headerBg,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          },
          headerTitleStyle: {
            fontWeight: '900',
            fontSize: 20,
            color: theme.text,
          },
          headerTintColor: theme.text,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Menu',
            headerTitle: () => (
              <View style={styles.headerTitleContainer}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Kitchen Co.</Text>
                <Text style={styles.headerSubtitle}>powered by CSG Group</Text>
              </View>
            ),
            headerRight: () => (
              <View style={styles.headerRightContainer}>
                <TouchableOpacity
                  style={styles.cartButton}
                  onPress={() => router.push('/cart')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={[styles.cartIconContainer, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                    <Ionicons name="cart" size={26} color={theme.text} />
                    {totalItems > 0 && (
                      <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeText}>{totalItems}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            ),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="fast-food" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            headerTitle: 'Past Orders',
            href: user ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tracker"
          options={{
            title: 'Orders',
            headerTitle: 'Order Status',
            href: user ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="receipt" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: user ? 'Profile' : 'Sign In',
            headerTitle: user ? 'My Profile' : 'Welcome',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={user ? "person" : "log-in"} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
            headerTitle: 'Kitchen Controls',
            href: user?.role === 'admin' ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="options" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: '900', 
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  cartButton: {
    position: 'relative',
  },
  cartIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2.5,
    borderColor: '#121212',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});