/**
 * Profile Screen Component
 *
 * Displays user profile information, addresses, saved cards, and quick actions.
 * Uses consistent black/grey/white color palette.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import {
  useKitchen,
  DeliveryAddress,
} from "../../context/KitchenCoContext";
import { useRouter } from "expo-router";

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
  } = useKitchen();
  const router = useRouter();

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressSuburb, setAddressSuburb] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressCode, setAddressCode] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteCardConfirm, setShowDeleteCardConfirm] = useState<
    string | null
  >(null);

  const handleSignOut = () => {
    logout();
    router.replace("/login");
  };

  const handleAddAddress = () => {
    if (!addressStreet.trim() || !addressSuburb.trim() || !addressCity.trim())
      return;

    const newAddress: DeliveryAddress = {
      id: `addr-${Date.now()}`,
      label: addressLabel.trim() || "Home",
      street: addressStreet.trim(),
      suburb: addressSuburb.trim(),
      city: addressCity.trim(),
      code: addressCode.trim(),
      isDefault: savedAddresses.length === 0,
    };

    addAddress(newAddress);
    setAddressLabel("");
    setAddressStreet("");
    setAddressSuburb("");
    setAddressCity("");
    setAddressCode("");
    setShowAddressModal(false);
  };

  const handleDeleteAddress = (addressId: string) => {
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
  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Status bar */}
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {/* Profile Card - User info and stats */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalOrders}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>R{totalSpent.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Spent</Text>
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
                <Text style={styles.badgeText}>
                  {isAdmin ? "Admin" : "User"}
                </Text>
              </View>
            </View>
          </View>
        </View>

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
          {savedAddresses.length === 0 ? (
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
              {savedAddresses.map((address, index) => (
                <React.Fragment key={address.id}>
                  {index > 0 && <View style={styles.menuDivider} />}
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
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.addressDeleteBtn}
                      onPress={() => setShowDeleteConfirm(address.id)}
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
                    >
                      <Text style={styles.cardDeleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Quick Actions Section */}
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

        {/* Sign Out Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleSignOut}
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
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.addressForm}>
              <Text style={styles.formLabel}>Label</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Home, Work, etc."
                placeholderTextColor="#6B6B6B"
                value={addressLabel}
                onChangeText={setAddressLabel}
              />

              <Text style={styles.formLabel}>Street Address *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Street name and number"
                placeholderTextColor="#6B6B6B"
                value={addressStreet}
                onChangeText={setAddressStreet}
              />

              <View style={styles.formRow}>
                <View style={styles.formRowHalf}>
                  <Text style={styles.formLabel}>Suburb *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Suburb"
                    placeholderTextColor="#6B6B6B"
                    value={addressSuburb}
                    onChangeText={setAddressSuburb}
                  />
                </View>
                <View style={styles.formRowHalf}>
                  <Text style={styles.formLabel}>City *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="City"
                    placeholderTextColor="#6B6B6B"
                    value={addressCity}
                    onChangeText={setAddressCity}
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Postal Code</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 2128"
                placeholderTextColor="#6B6B6B"
                value={addressCode}
                onChangeText={setAddressCode}
                keyboardType="numeric"
              />

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
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() =>
                  showDeleteConfirm && handleDeleteAddress(showDeleteConfirm)
                }
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
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() =>
                  showDeleteCardConfirm &&
                  removeCard(showDeleteCardConfirm)
                }
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

// Base styles with consistent black/grey/white color palette
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  scrollContent: { paddingBottom: 32 },

  header: { padding: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "900", color: "#FFFFFF", marginBottom: 4 },

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
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: "#6B6B6B",
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  signInButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  signInButtonText: { color: "#000000", fontWeight: "800", fontSize: 16 },

  profileCard: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 16,
    marginBottom: 28,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  avatarContainer: { position: "relative", marginBottom: 16 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#5AC8FA",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarText: { fontSize: 36, fontWeight: "900", color: "#000000" },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#00C853",
    borderWidth: 3,
    borderColor: "#121212",
  },
  profileName: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", marginBottom: 6 },
  profileEmail: { fontSize: 14, color: "#8E8E93", marginBottom: 20 },

  statsRow: {
    flexDirection: "row",
    width: "100%",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "900", color: "#FFFFFF", marginBottom: 4 },
  statLabel: {
    fontSize: 12,
    color: "#8E8E93",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, backgroundColor: "#2C2C2E", marginHorizontal: 16 },

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
    color: "#6B6B6B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  addAddressBtn: { backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  addAddressBtnText: { color: "#000000", fontSize: 13, fontWeight: "800" },

  menuCard: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
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
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  menuIconText: { fontSize: 22 },
  menuIconAdmin: { backgroundColor: "#3D2F00" },
  menuIconUser: { backgroundColor: "#1E1E1E" },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  menuItemSubtitle: { fontSize: 13, color: "#8E8E93", fontWeight: "500" },
  menuArrow: { fontSize: 28, color: "#6B6B6B", fontWeight: "300" },
  menuDivider: { height: 1, backgroundColor: "#2C2C2E", marginHorizontal: 16 },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  badgeUser: { backgroundColor: "#1A1A1A" },
  badgeAdmin: { backgroundColor: "#3D2F00" },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },

  // Address Styles
  emptyAddressCard: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderStyle: "dashed",
  },
  emptyAddressIcon: { fontSize: 32, marginBottom: 12 },
  emptyAddressText: { fontSize: 15, fontWeight: "700", color: "#8E8E93", marginBottom: 6 },
  emptyAddressSubtext: { fontSize: 12, color: "#6B6B6B", textAlign: "center" },
  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  addressItemLeft: { flex: 1 },
  defaultBadge: {
    backgroundColor: "#00C853",
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
  addressLabel: { fontSize: 15, fontWeight: "800", color: "#FFFFFF", marginRight: 10 },
  setDefaultLink: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: "#1E1E1E",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  setDefaultText: { fontSize: 10, color: "#5AC8FA", fontWeight: "700" },
  addressLine1: { fontSize: 13, color: "#A0A0A0", fontWeight: "500", marginBottom: 2 },
  addressLine2: { fontSize: 12, color: "#8E8E93", fontWeight: "500" },
  addressDeleteBtn: { padding: 8, marginLeft: 10 },
  addressDeleteIcon: { fontSize: 18 },

  footer: { alignItems: "center", paddingHorizontal: 16, paddingTop: 24 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    paddingVertical: 16,
    borderRadius: 16,
    alignSelf: "stretch",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoutIcon: { fontSize: 18, marginRight: 10 },
  logoutText: { color: "#FF3B30", fontSize: 16, fontWeight: "800" },
  version: { fontSize: 12, color: "#6B6B6B", fontWeight: "600" },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0C0C0C",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: "#1C1C1E",
    shadowColor: "#FFFFFF",
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
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", letterSpacing: -0.5 },
  modalClose: { fontSize: 28, color: "#8E8E93", fontWeight: "600" },
  addressForm: {},
  formLabel: {
    fontSize: 12,
    color: "#8E8E93",
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#1C1C1E",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: "#FFFFFF",
  },
  formRow: { flexDirection: "row", gap: 12 },
  formRowHalf: { flex: 1 },
  saveAddressBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  saveAddressBtnDisabled: { opacity: 0.4 },
  saveAddressBtnText: { color: "#000000", fontSize: 16, fontWeight: "800" },

  // Delete Confirm Modal
  deleteConfirmCard: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  deleteConfirmIcon: { fontSize: 40, marginBottom: 12 },
  deleteConfirmTitle: { fontSize: 20, fontWeight: "900", color: "#FFFFFF", marginBottom: 6 },
  deleteConfirmText: { fontSize: 14, color: "#8E8E93", marginBottom: 24, textAlign: "center" },
  deleteConfirmButtons: { flexDirection: "row", gap: 12 },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
  },
  deleteCancelText: { color: "#8E8E93", fontSize: 15, fontWeight: "800" },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#FF3B30",
    alignItems: "center",
  },
  deleteConfirmBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },

  // Saved Cards Styles
  addCardBtn: { backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  addCardBtnText: { color: "#000000", fontSize: 13, fontWeight: "800" },
  emptyCardCard: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderStyle: "dashed",
  },
  emptyCardIcon: { fontSize: 32, marginBottom: 12 },
  emptyCardText: { fontSize: 15, fontWeight: "700", color: "#8E8E93", marginBottom: 6 },
  emptyCardSubtext: { fontSize: 12, color: "#6B6B6B", textAlign: "center" },
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
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  cardIconText: { fontSize: 16 },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 2 },
  cardNumber: { fontSize: 13, color: "#A0A0A0", fontWeight: "500", marginBottom: 2 },
  cardExpiry: { fontSize: 12, color: "#8E8E93" },
  cardDeleteBtn: { padding: 8, marginLeft: 10 },
  cardDeleteIcon: { fontSize: 18 },
});