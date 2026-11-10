import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ActiveOrderStatusFilter } from '../types';
import { AdminNavStrip, AdminRoute } from '../components/admin/AdminNavStrip';
import { AdminOverviewTab } from '../components/admin/AdminOverviewTab';
import { AdminActiveOrdersTab } from '../components/admin/AdminActiveOrdersTab';
import { AdminCompaniesTab } from '../components/admin/AdminCompaniesTab';
import { AdminNotificationsTab } from '../components/admin/AdminNotificationsTab';
import { AdminMenuTab } from '../components/admin/AdminMenuTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminReportsTab } from '../components/admin/AdminReportsTab';
import { AdminSettingsTab } from '../components/admin/AdminSettingsTab';

export interface AdminPortalScreenProps {
  onEnterCustomerView?: () => void;
  onNavigateToMenu?: () => void;
}

const CHEF_ROUTES: AdminRoute[] = ['overview', 'active-orders', 'reports'];

export const AdminPortalScreen: React.FC<AdminPortalScreenProps> = ({
  onEnterCustomerView,
  onNavigateToMenu,
}) => {
  const { theme } = useTheme();
  const { signOut, currentUser } = useAuth();
  // Chefs view orders and reports and export kitchen documents. The database enforces this too.
  const isChef = currentUser?.role === 'chef';
  const [activeRoute, setActiveRoute] = useState<AdminRoute>('overview');
  const [statusFilter, setStatusFilter] = useState<ActiveOrderStatusFilter>('all');

  const handleNavigateToActiveOrders = (filter: ActiveOrderStatusFilter = 'all') => {
    setStatusFilter(filter);
    setActiveRoute('active-orders');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* 1. Apple Glass Central Command Admin Nav Strip with Live Clock & 8 Section Pills */}
      <AdminNavStrip
        activeRoute={activeRoute}
        allowedRoutes={isChef ? CHEF_ROUTES : undefined}
        onRouteChange={(route) => {
          if (route === 'active-orders' && activeRoute !== 'active-orders') {
            setStatusFilter('all');
          }
          setActiveRoute(route);
        }}
        onEnterCustomerView={onEnterCustomerView}
        onLogout={signOut}
      />

      {/* 2. Admin Content View */}
      <View style={styles.contentContainer}>
        {activeRoute === 'overview' && (
          <AdminOverviewTab onNavigateToActiveOrders={handleNavigateToActiveOrders} />
        )}
        {activeRoute === 'active-orders' && (
          <AdminActiveOrdersTab
            initialStatusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        )}
        {!isChef && activeRoute === 'companies' && <AdminCompaniesTab />}
        {!isChef && activeRoute === 'notifications' && <AdminNotificationsTab />}
        {!isChef && activeRoute === 'menu' && <AdminMenuTab />}
        {!isChef && activeRoute === 'users' && <AdminUsersTab />}
        {activeRoute === 'reports' && <AdminReportsTab />}
        {!isChef && activeRoute === 'settings' && <AdminSettingsTab />}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
});
