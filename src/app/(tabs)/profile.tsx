/**
 * Profile Screen Component
 *
 * Displays user profile information, addresses, saved cards, and quick actions.
 * Uses consistent black/grey/white color palette.
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useKitchen,
  DeliveryAddress,
} from "../../context/KitchenCoContext";
import { useRouter } from "expo-router";
import { calculateDeliveryFee } from "../../utils/deliveryHelpers";
import { ThemeColors } from "../../utils/theme";
import { haptics } from "../../utils/haptics";

export default function TabProfileScreen() {
  const {
    user,
    logout,
    orders,
    savedCards,
    removeCard,
    savedAddresses,
    addAddress,
    removeAddress,
    setDefaultAddress,
    useCompanyAddress,
    companies,
    deliveryInfo,
    remindersEnabled,
    setRemindersEnabled,
    theme,
    themeMode,
    setThemeMode,
  } = useKitchen();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Corporate accounts have a registered company address on top of any
  // personal addresses — shown as a selectable entry rather than hidden,
  // since it's the effective delivery destination until the employee
  // explicitly picks a personal one instead.
  const company = user?.companyName ? companies.find(c => c.name === user.companyName) : null;
  const companyAddress = company?.address?.distanceKm != null ? company.address : null;
  const isCompanyAddressDefault = companyAddress != null && deliveryInfo.address?.id === `company-${company?.id}`;

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressSuburb, setAddressSuburb] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressCode, setAddressCode] = useState("");
  const [addressDistance, setAddressDistance] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteCardConfirm, setShowDeleteCardConfirm] = useState<
    string | null
  >(null);

  const handleSignOut = () => {
    haptics.medium();
    logout();
    router.replace("/login");
  };

  const handleAddAddress = () => {
    if (!addressStreet.trim() || !addressSuburb.trim() || !addressCity.trim())
      return;

    const parsedDistance = parseFloat(addressDistance);

    const newAddress: DeliveryAddress = {
      id: `addr-${Date.now()}`,
      label: addressLabel.trim() || "Home",
      street: addressStreet.trim(),
      suburb: addressSuburb.trim(),
      city: addressCity.trim(),
      code: addressCode.trim(),
      isDefault: savedAddresses.length === 0,
      distanceKm: Number.isFinite(parsedDistance) ? parsedDistance : undefined,
    };

    addAddress(newAddress);
    setAddressLabel("");
    setAddressStreet("");
    setAddressSuburb("");
    setAddressCity("");
    setAddressCode("");
    setAddressDistance("");
    setShowAddressModal(false);
  };

  const handleDeleteAddress = (addressId: string) => {
    haptics.warning();
    removeAddress(addressId);
    setShowDeleteConfirm(null);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeIcon}>👋</Text>
            <Text style={styles.welcomeTitle}>Welcome to Kitchen Co.</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to order delicious meals and track your orders
            </Text>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.signInButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isAdmin = user.role === "admin";
  const totalOrders = orders.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Status bar */}
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Profile Card — compact identity + stats */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </Text>
              </View>
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
              <View style={[styles.roleChip, isAdmin && styles.roleChipAdmin]}>
                <Text
                  style={[
                    styles.roleChipText,
                    isAdmin && styles.roleChipTextAdmin,
                  ]}
                >
                  {isAdmin ? "Admin" : "Customer"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalOrders}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
          </View>
        </View>

        {/* Account Type Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View
                  style={[
                    styles.menuIcon,
                    isAdmin ? styles.menuIconAdmin : styles.menuIconUser,
                  ]}
                >
                  <Text style={styles.menuIconText}>
                    {isAdmin ? "👑" : "⭐"}
                  </Text>
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Account Type</Text>
                  <Text style={styles.menuItemSubtitle}>
                    {isAdmin ? "Administrator" : "Customer"}
                  </Text>
                </View>
              </View>
              <View style={[styles.badge, isAdmin ? styles.badgeAdmin : styles.badgeUser]}>
                <Text style={[styles.badgeText, isAdmin && styles.badgeTextAdmin]}>
                  {isAdmin ? "Admin" : "User"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Appearance Section — theme preference, available to every account type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.menuCard}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIcon}>
                  <Text style={styles.menuIconText}>🌗</Text>
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Theme</Text>
                  <Text style={styles.menuItemSubtitle}>
                    Choose how KitchenCo looks
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.menuDivider} />

            <View style={styles.themeToggleRow} accessibilityRole="radiogroup">
              {(
                [
                  { mode: "light" as const, label: "Light" },
                  { mode: "dark" as const, label: "Dark" },
                  { mode: "system" as const, label: "Match device" },
                ]
              ).map(({ mode, label }) => {
                const isActive = themeMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.themeToggleOption,
                      isActive && styles.themeToggleOptionActive,
                    ]}
                    onPress={() => {
                      haptics.selection();
                      setThemeMode(mode);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`${label} theme`}
                  >
                    <Text
                      style={[
                        styles.themeToggleOptionText,
                        isActive && styles.themeToggleOptionTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Notifications Section — customers only; admins don't place
            personal orders so there's nothing to remind them about. */}
        {!isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.menuCard}>
              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Text style={styles.menuIconText}>🔔</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuItemTitle}>Order reminders</Text>
                    <Text style={styles.menuItemSubtitle}>
                      One nudge on business days if you haven't ordered yet
                    </Text>
                  </View>
                </View>
                <Switch
                  value={remindersEnabled}
                  onValueChange={(value) => {
                    haptics.selection();
                    setRemindersEnabled(value);
                  }}
                  trackColor={{ false: theme.border, true: theme.success }}
                  thumbColor={theme.surface}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: remindersEnabled }}
                  accessibilityLabel="Order reminders"
                />
              </View>
            </View>
          </View>
        )}

        {/* Delivery Addresses Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Addresses</Text>
            <TouchableOpacity
              onPress={() => setShowAddressModal(true)}
              style={styles.addAddressBtn}
            >
              <Text style={styles.addAddressBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {companyAddress ? (
            <Text style={styles.companyAddressHint}>
              {isCompanyAddressDefault
                ? `Orders deliver to your ${company?.name} address by default. Add a personal address below if you'd like an order sent elsewhere.`
                : `A personal address is set as default. You can switch back to your ${company?.name} address any time.`}
            </Text>
          ) : null}
          {savedAddresses.length === 0 && !companyAddress ? (
            <TouchableOpacity
              style={styles.emptyAddressCard}
              onPress={() => setShowAddressModal(true)}
            >
              <Text style={styles.emptyAddressIcon}>📍</Text>
              <Text style={styles.emptyAddressText}>No addresses saved yet</Text>
              <Text style={styles.emptyAddressSubtext}>
                Tap to add your first delivery address
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.menuCard}>
              {companyAddress && (
                <View style={styles.addressItem}>
                  <View style={styles.addressItemLeft}>
                    {isCompanyAddressDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                    <View style={styles.addressInfo}>
                      <View style={styles.addressLabelRow}>
                        <Text style={styles.addressLabel}>{company?.name} (Company Address)</Text>
                        {!isCompanyAddressDefault && (
                          <TouchableOpacity
                            onPress={useCompanyAddress}
                            style={styles.setDefaultLink}
                          >
                            <Text style={styles.setDefaultText}>Set as default</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.addressLine1}>
                        {companyAddress.unit ? `${companyAddress.unit}, ${companyAddress.street}` : companyAddress.street}
                      </Text>
                      <Text style={styles.addressLine2}>
                        {companyAddress.suburb}, {companyAddress.city} {companyAddress.code}
                      </Text>
                      <Text style={styles.addressFee}>
                        {companyAddress.distanceKm}km · R{calculateDeliveryFee(companyAddress.distanceKm!)} delivery fee
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              {savedAddresses.map((address, index) => (
                <React.Fragment key={address.id}>
                  {(index > 0 || companyAddress) && <View style={styles.menuDivider} />}
                  <TouchableOpacity
                    style={styles.addressItem}
                    onLongPress={() => setShowDeleteConfirm(address.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addressItemLeft}>
                      {address.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                      <View style={styles.addressInfo}>
                        <View style={styles.addressLabelRow}>
                          <Text style={styles.addressLabel}>{address.label}</Text>
                          {!address.isDefault && (
                            <TouchableOpacity
                              onPress={() => setDefaultAddress(address.id)}
                              style={styles.setDefaultLink}
                            >
                              <Text style={styles.setDefaultText}>
                                Set as default
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.addressLine1}>{address.street}</Text>
                        <Text style={styles.addressLine2}>
                          {address.suburb}, {address.city} {address.code}
                        </Text>
                        <Text style={styles.addressFee}>
                          {address.distanceKm != null
                            ? (() => {
                                const fee = calculateDeliveryFee(address.distanceKm);
                                return fee != null
                                  ? `${address.distanceKm}km · R${fee} delivery fee`
                                  : `${address.distanceKm}km · outside delivery area`;
                              })()
                            : 'Add a distance to see delivery fee'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.addressDeleteBtn}
                      onPress={() => setShowDeleteConfirm(address.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete address: ${address.label}`}
                    >
                      <Text style={styles.addressDeleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Saved Cards Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Cards</Text>
            <TouchableOpacity
              onPress={() => router.push("/payfast")}
              style={styles.addCardBtn}
            >
              <Text style={styles.addCardBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {savedCards.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyCardCard}
              onPress={() => router.push("/payfast")}
            >
              <Text style={styles.emptyCardIcon}>💳</Text>
              <Text style={styles.emptyCardText}>No cards saved yet</Text>
              <Text style={styles.emptyCardSubtext}>
                Save a card at checkout for faster payments
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.menuCard}>
              {savedCards.map((card, index) => (
                <React.Fragment key={card.id}>
                  {index > 0 && <View style={styles.menuDivider} />}
                  <View style={styles.cardItem}>
                    <View style={styles.cardItemLeft}>
                      <View style={styles.cardIcon}>
                        <Text style={styles.cardIconText}>
                          {card.cardType === "visa"
                            ? "💳"
                            : card.cardType === "mastercard"
                              ? "💎"
                              : "💳"}
                        </Text>
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardLabel}>{card.cardholderName}</Text>
                        <Text style={styles.cardNumber}>{card.cardNumber}</Text>
                        <Text style={styles.cardExpiry}>
                          Expires {card.expiryDate}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.cardDeleteBtn}
                      onPress={() => setShowDeleteCardConfirm(card.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete card ending in ${card.cardNumber}`}
                    >
                      <Text style={styles.cardDeleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Help & Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help &amp; Support</Text>
          <View style={styles.menuCard}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIcon}>
                  <Text style={styles.menuIconText}>✉️</Text>
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Email Support</Text>
                  <Text style={styles.menuItemSubtitle}>
                    support@kitchenco.co.za
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.menuDivider} />

            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIcon}>
                  <Text style={styles.menuIconText}>📞</Text>
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Call Us</Text>
                  <Text style={styles.menuItemSubtitle}>
                    011 234 5678 · Mon–Fri, 08:00–17:00
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions Section — customer ordering shortcuts only; admins
            manage the kitchen from the Admin tab, not place personal orders. */}
        {!isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.menuCard}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/cart")}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Text style={styles.menuIconText}>🛒</Text>
                  </View>
                  <View>
                    <Text style={styles.menuItemTitle}>View Cart</Text>
                    <Text style={styles.menuItemSubtitle}>Check your items</Text>
                  </View>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/activity")}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Text style={styles.menuIconText}>📋</Text>
                  </View>
                  <View>
                    <Text style={styles.menuItemTitle}>Order History</Text>
                    <Text style={styles.menuItemSubtitle}>View past orders</Text>
                  </View>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/tracker")}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Text style={styles.menuIconText}>📍</Text>
                  </View>
                  <View>
                    <Text style={styles.menuItemTitle}>Track Order</Text>
                    <Text style={styles.menuItemSubtitle}>Current order status</Text>
                  </View>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sign Out Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
          <Text style={styles.version}>Kitchen Co. v1.0</Text>
        </View>
      </ScrollView>

      {/* Add Address Modal */}
      <Modal
        visible={showAddressModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Delivery Address</Text>
              <TouchableOpacity
                onPress={() => setShowAddressModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.addressForm}>
              <Text style={styles.formLabel}>Label</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Home, Work, etc."
                placeholderTextColor={theme.textTertiary}
                value={addressLabel}
                onChangeText={setAddressLabel}
              />

              <Text style={styles.formLabel}>Street Address *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Street name and number"
                placeholderTextColor={theme.textTertiary}
                value={addressStreet}
                onChangeText={setAddressStreet}
              />

              <View style={styles.formRow}>
                <View style={styles.formRowHalf}>
                  <Text style={styles.formLabel}>Suburb *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Suburb"
                    placeholderTextColor={theme.textTertiary}
                    value={addressSuburb}
                    onChangeText={setAddressSuburb}
                  />
                </View>
                <View style={styles.formRowHalf}>
                  <Text style={styles.formLabel}>City *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="City"
                    placeholderTextColor={theme.textTertiary}
                    value={addressCity}
                    onChangeText={setAddressCity}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formRowHalf}>
                  <Text style={styles.formLabel}>Postal Code</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 2128"
                    placeholderTextColor={theme.textTertiary}
                    value={addressCode}
                    onChangeText={setAddressCode}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formRowHalf}>
                  <Text style={styles.formLabel}>Distance (km)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 14"
                    placeholderTextColor={theme.textTertiary}
                    value={addressDistance}
                    onChangeText={setAddressDistance}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Text style={styles.formHint}>
                Road distance from the kitchen — sets your delivery fee (R100–R350 by distance band).
              </Text>

              <TouchableOpacity
                style={[
                  styles.saveAddressBtn,
                  (!addressStreet.trim() ||
                    !addressSuburb.trim() ||
                    !addressCity.trim()) &&
                    styles.saveAddressBtnDisabled,
                ]}
                onPress={handleAddAddress}
                disabled={
                  !addressStreet.trim() ||
                  !addressSuburb.trim() ||
                  !addressCity.trim()
                }
              >
                <Text style={styles.saveAddressBtnText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!showDeleteConfirm}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteConfirm(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteConfirmCard}>
            <Text style={styles.deleteConfirmIcon}>🗑️</Text>
            <Text style={styles.deleteConfirmTitle}>Remove Address?</Text>
            <Text style={styles.deleteConfirmText}>
              This action cannot be undone
            </Text>
            <View style={styles.deleteConfirmButtons}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setShowDeleteConfirm(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() =>
                  showDeleteConfirm && handleDeleteAddress(showDeleteConfirm)
                }
                accessibilityRole="button"
                accessibilityLabel="Confirm remove address"
              >
                <Text style={styles.deleteConfirmBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Card Confirmation Modal */}
      <Modal
        visible={!!showDeleteCardConfirm}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteCardConfirm(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteConfirmCard}>
            <Text style={styles.deleteConfirmIcon}>🗑️</Text>
            <Text style={styles.deleteConfirmTitle}>Remove Card?</Text>
            <Text style={styles.deleteConfirmText}>
              This action cannot be undone
            </Text>
            <View style={styles.deleteConfirmButtons}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setShowDeleteCardConfirm(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => {
                  if (showDeleteCardConfirm) {
                    haptics.warning();
                    removeCard(showDeleteCardConfirm);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Confirm remove card"
              >
                <Text style={styles.deleteConfirmBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    </SafeAreaView>
  );
}

// Theme-driven styles — see src/utils/theme.ts for the ThemeColors palette.
const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
    scrollContent: {
    paddingBottom: 32,
    // Keep cards at a readable width on tablet-sized frames instead of
    // stretching full-width across the wider layout.
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },

  header: { padding: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "900", color: theme.text, marginBottom: 4 },

  welcomeCard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    marginTop: 80,
  },
  welcomeIcon: { fontSize: 64, marginBottom: 20 },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.text,
    marginBottom: 12,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  signInButton: {
    backgroundColor: theme.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  signInButtonText: { color: theme.onAccent, fontWeight: "800", fontSize: 16 },

    profileCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  profileInfo: { flex: 1, marginLeft: 16 },
  avatarContainer: { position: "relative" },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 24, fontWeight: "900", color: theme.onAccent },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.success,
    borderWidth: 2.5,
    borderColor: theme.surface,
  },
  profileName: { fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 2 },
  profileEmail: { fontSize: 13, color: theme.textSecondary, marginBottom: 8 },
  roleChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.border,
  },
  roleChipText: { fontSize: 11, fontWeight: "700", color: theme.textSecondary },
  roleChipAdmin: { backgroundColor: "#FFF3C4" },
  roleChipTextAdmin: { color: "#8A6D00" },

  statsRow: {
    flexDirection: "row",
    width: "100%",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "900", color: theme.text, marginBottom: 4 },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, backgroundColor: theme.border, marginHorizontal: 16 },

  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  addAddressBtn: { backgroundColor: theme.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  addAddressBtnText: { color: theme.onAccent, fontSize: 13, fontWeight: "800" },
  companyAddressHint: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  menuCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  menuIconText: { fontSize: 22 },
  menuIconAdmin: { backgroundColor: "#FFF3C4" },
  menuIconUser: { backgroundColor: theme.surfaceSecondary },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.text,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  menuItemSubtitle: { fontSize: 13, color: theme.textSecondary, fontWeight: "500" },
  menuArrow: { fontSize: 28, color: theme.textSecondary, fontWeight: "300" },
  menuDivider: { height: 1, backgroundColor: theme.border, marginHorizontal: 16 },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  badgeUser: { backgroundColor: theme.surfaceSecondary },
  badgeAdmin: { backgroundColor: "#FFF3C4" },
  badgeText: { color: theme.text, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  badgeTextAdmin: { color: "#8A6D00" },

  // Theme toggle (Light / Dark / Match device) — same active/inactive pill
  // language as the badge/role-chip components above.
  themeToggleRow: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
  },
  themeToggleOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSecondary,
  },
  themeToggleOptionActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  themeToggleOptionText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.textSecondary,
  },
  themeToggleOptionTextActive: {
    color: theme.onAccent,
  },

  // Address Styles
  emptyAddressCard: {
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderStyle: "dashed",
  },
  emptyAddressIcon: { fontSize: 32, marginBottom: 12 },
  emptyAddressText: { fontSize: 15, fontWeight: "700", color: theme.textSecondary, marginBottom: 6 },
  emptyAddressSubtext: { fontSize: 12, color: theme.textSecondary, textAlign: "center" },
  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  addressItemLeft: { flex: 1 },
  defaultBadge: {
    backgroundColor: theme.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  defaultBadgeText: { color: "#000000", fontSize: 10, fontWeight: "800" },
  addressInfo: {},
  addressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  addressLabel: { fontSize: 15, fontWeight: "800", color: theme.text, marginRight: 10 },
  setDefaultLink: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  setDefaultText: { fontSize: 10, color: theme.text, fontWeight: "700", textDecorationLine: "underline" },
  addressLine1: { fontSize: 13, color: theme.textSecondary, fontWeight: "500", marginBottom: 2 },
  addressLine2: { fontSize: 12, color: theme.textSecondary, fontWeight: "500" },
  addressFee: { fontSize: 11.5, color: theme.text, fontWeight: "600", marginTop: 3 },
  addressDeleteBtn: { padding: 8, marginLeft: 10 },
  addressDeleteIcon: { fontSize: 18 },

  footer: { alignItems: "center", paddingHorizontal: 16, paddingTop: 24 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 16,
    borderRadius: 16,
    alignSelf: "stretch",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoutIcon: { fontSize: 18, marginRight: 10 },
  logoutText: { color: theme.error, fontSize: 16, fontWeight: "800" },
  version: { fontSize: 12, color: theme.textSecondary, fontWeight: "600" },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.modalOverlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: theme.text, letterSpacing: -0.5 },
  modalClose: { fontSize: 28, color: theme.textSecondary, fontWeight: "600" },
  addressForm: {},
  formHint: {
    fontSize: 11.5,
    color: theme.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  formLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: theme.text,
  },
  formRow: { flexDirection: "row", gap: 12 },
  formRowHalf: { flex: 1 },
  saveAddressBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  saveAddressBtnDisabled: { opacity: 0.4 },
  saveAddressBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: "800" },

  // Delete Confirm Modal
  deleteConfirmCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  deleteConfirmIcon: { fontSize: 40, marginBottom: 12 },
  deleteConfirmTitle: { fontSize: 20, fontWeight: "900", color: theme.text, marginBottom: 6 },
  deleteConfirmText: { fontSize: 14, color: theme.textSecondary, marginBottom: 24, textAlign: "center" },
  deleteConfirmButtons: { flexDirection: "row", gap: 12 },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    backgroundColor: theme.surfaceSecondary,
  },
  deleteCancelText: { color: theme.textSecondary, fontSize: 15, fontWeight: "800" },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.error,
    alignItems: "center",
  },
  deleteConfirmBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },

  // Saved Cards Styles
  addCardBtn: { backgroundColor: theme.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  addCardBtnText: { color: theme.onAccent, fontSize: 13, fontWeight: "800" },
  emptyCardCard: {
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderStyle: "dashed",
  },
  emptyCardIcon: { fontSize: 32, marginBottom: 12 },
  emptyCardText: { fontSize: 15, fontWeight: "700", color: theme.textSecondary, marginBottom: 6 },
  emptyCardSubtext: { fontSize: 12, color: theme.textSecondary, textAlign: "center" },
  cardItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  cardItemLeft: { flex: 1, flexDirection: "row", alignItems: "center" },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardIconText: { fontSize: 16 },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 2 },
  cardNumber: { fontSize: 13, color: theme.textSecondary, fontWeight: "500", marginBottom: 2 },
  cardExpiry: { fontSize: 12, color: theme.textSecondary },
  cardDeleteBtn: { padding: 8, marginLeft: 10 },
  cardDeleteIcon: { fontSize: 18 },
});
