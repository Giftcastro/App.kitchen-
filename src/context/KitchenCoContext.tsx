import React, { createContext, useContext, useState, Dispatch, SetStateAction, useMemo, useEffect } from 'react';
import { ThemeColors, getThemeColors } from '../utils/theme';

export type AccountType = 'individual' | 'company';

export interface User {
  name?: string;
  email: string;
  role: string;
  accountType?: AccountType;
  companyName?: string;
}

export interface AppUser extends User {
  id: string;
  joinedDate: string;
  orderCount: number;
  companyName?: string;
  accountType?: AccountType;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  image?: string;
  selectedSize?: string;
  notes?: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  totalPrice: number;
  status: string;
  date: string;
  timestamp: string;
  userEmail?: string;
  userName?: string;
  deliveryAddress?: DeliveryAddress;
  note?: string;
  discount?: Discount;
  discountAmount?: number;
}

export interface DeliveryAddress {
  id: string;
  label: string;
  street: string;
  suburb: string;
  city: string;
  code: string;
  isDefault: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    description: string;
    price: number;
    image?: string;
  }[];
}

export interface SavedCard {
  id: string;
  cardholderName: string;
  cardNumber: string; // Masked - last 4 digits only
  expiryDate: string;
  cardType: 'visa' | 'mastercard' | 'amex' | 'other';
  createdAt: string;
}

export interface Discount {
  id: string;
  code: string;
  percentage: number;
  active: boolean;
  expires?: string;
  // Target specific company/category or item
  company?: string;
  categoryId?: string;
  itemName?: string;
}

interface KitchenContextType {
  user: User | null;
  cart: CartItem[];
  orders: Order[];
  orderNote: string;
  setOrderNote: Dispatch<SetStateAction<string>>;
  appliedDiscount: Discount | null;
  setAppliedDiscount: Dispatch<SetStateAction<Discount | null>>;
  activeWeek: number;
  setActiveWeek: Dispatch<SetStateAction<number>>;
  login: (email: string, role: string, name?: string, accountType?: AccountType, companyName?: string) => void;
  logout: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  placeOrder: (deliveryAddress?: DeliveryAddress) => void;
  allUsers: AppUser[];
  menus: MenuCategory[];
  discounts: Discount[];
  addMenuItem: (categoryId: string, item: any) => void;
  updateMenuItem: (categoryId: string, itemId: string, item: any) => void;
  deleteMenuItem: (categoryId: string, itemId: string) => void;
  addDiscount: (discount: Discount) => void;
  updateDiscount: (discountId: string, discount: Partial<Discount>) => void;
  deleteDiscount: (discountId: string) => void;
  addUser: (user: AppUser) => void;
  updateUser: (userId: string, updates: Partial<AppUser>) => void;
  deleteUser: (userId: string) => void;
  savedAddresses: DeliveryAddress[];
  addAddress: (address: DeliveryAddress) => void;
  removeAddress: (addressId: string) => void;
  setDefaultAddress: (addressId: string) => void;
  savedCards: SavedCard[];
  saveCard: (card: Omit<SavedCard, 'id' | 'createdAt'>) => void;
  removeCard: (cardId: string) => void;
  theme: ThemeColors;
  isItemEligibleForDiscount: (item: CartItem, discount: Discount | null) => boolean;
  calculateDiscountAmount: (cartItems: CartItem[], discount: Discount | null) => number;
}

export const KitchenCoContext = createContext<KitchenContextType | undefined>(undefined);

export function KitchenProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [menus, setMenus] = useState<MenuCategory[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [orderNote, setOrderNote] = useState<string>('');
  const theme = useMemo(() => getThemeColors(), []);

  // Demo data for orders and users
  React.useEffect(() => {
    const demoUsers: AppUser[] = [
      { id: 'USR-1001', name: 'John Customer', email: 'john@example.com', role: 'customer', joinedDate: '12 Jun 2026', orderCount: 3 },
      { id: 'USR-1002', name: 'Jane Smith', email: 'jane@example.com', role: 'customer', joinedDate: '28 May 2026', orderCount: 7 },
      { id: 'USR-1003', name: 'Mike Johnson', email: 'mike@example.com', role: 'customer', joinedDate: '5 Jun 2026', orderCount: 1 },
    ];
    
    const todayStr = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    
    const demoOrders: Order[] = [
      {
        id: 'ORD-1290',
        items: [
          { id: 'today-1', name: 'Grilled Chicken & Mushroom Pasta', price: 140, category: 'CIAO ITALY', quantity: 2, selectedSize: 'Regular' },
          { id: 'today-2', name: 'Caesar Salad', price: 80, category: 'SALADS & BOWLS', quantity: 1 },
          { id: 'today-3', name: 'Garlic Bread', price: 35, category: 'SIDES & SAUCES', quantity: 1 },
        ],
        total: 395,
        totalPrice: 395,
        status: 'on_the_way',
        date: todayStr,
        timestamp: todayStr,
        userEmail: 'john@example.com',
        userName: 'John Customer',
        deliveryAddress: {
          id: 'addr-1',
          label: 'Home',
          street: '12 Oak Avenue',
          suburb: 'Rivonia',
          city: 'Johannesburg',
          code: '2128',
          isDefault: true,
        },
      },
      {
        id: 'ORD-1234',
        items: [
          { id: '1', name: 'Grilled Chicken & Mushroom Pasta', price: 140, category: 'CIAO ITALY', quantity: 1, selectedSize: 'Regular' },
          { id: '2', name: 'Garlic Bread', price: 35, category: 'SIDES & SAUCES', quantity: 1 },
        ],
        total: 175,
        totalPrice: 175,
        status: 'pending',
        date: '17 Jul 2026, 10:30',
        timestamp: '17 Jul 2026, 10:30',
        userEmail: 'john@example.com',
        userName: 'John Customer',
        deliveryAddress: {
          id: 'addr-1',
          label: 'Home',
          street: '12 Oak Avenue',
          suburb: 'Rivonia',
          city: 'Johannesburg',
          code: '2128',
          isDefault: true,
        },
      },
      {
        id: 'ORD-1233',
        items: [
          { id: '3', name: 'Creamy Chicken & Mushroom Pasta', price: 140, category: 'CIAO ITALY', quantity: 1, selectedSize: 'Regular' },
          { id: '4', name: 'Green Salad', price: 20, category: 'SIDES & SAUCES', quantity: 1 },
        ],
        total: 160,
        totalPrice: 160,
        status: 'delivered',
        date: '16 Jul 2026, 14:20',
        timestamp: '16 Jul 2026, 14:20',
        userEmail: 'jane@example.com',
        userName: 'Jane Smith',
        deliveryAddress: {
          id: 'addr-2',
          label: 'Work',
          street: '45 Maude Street',
          suburb: 'Sandton',
          city: 'Johannesburg',
          code: '2196',
          isDefault: true,
        },
      },
      {
        id: 'ORD-1232',
        items: [
          { id: '5', name: 'Beef Lasagne', price: 140, category: 'CIAO ITALY', quantity: 1, selectedSize: 'Regular' },
        ],
        total: 140,
        totalPrice: 140,
        status: 'delivered',
        date: '15 Jul 2026, 12:45',
        timestamp: '15 Jul 2026, 12:45',
        userEmail: 'jane@example.com',
        userName: 'Jane Smith',
      },
      {
        id: 'ORD-1231',
        items: [
          { id: '6', name: 'Chicken Bacon & Avocado Wrap', price: 95, category: 'WRAPS & SANDWICHES', quantity: 2, selectedSize: 'Regular' },
          { id: '7', name: 'Lemon & Herb Chicken Pasta Salad', price: 85, category: 'SALADS & BOWLS', quantity: 1 },
          { id: '8', name: 'Sweet Potato Fries', price: 50, category: 'SIDES & SAUCES', quantity: 1 },
        ],
        total: 325,
        totalPrice: 325,
        status: 'delivered',
        date: '14 Jul 2026, 11:20',
        timestamp: '14 Jul 2026, 11:20',
        userEmail: 'mike@example.com',
        userName: 'Mike Johnson',
        deliveryAddress: {
          id: 'addr-3',
          label: 'Home',
          street: '8 Park Lane',
          suburb: 'Parktown',
          city: 'Johannesburg',
          code: '2193',
          isDefault: true,
        },
      },
      {
        id: 'ORD-1230',
        items: [
          { id: '9', name: 'Grilled Chicken Salad', price: 110, category: 'SALADS & BOWLS', quantity: 1, selectedSize: 'Regular' },
        ],
        total: 110,
        totalPrice: 110,
        status: 'cancelled',
        date: '13 Jul 2026, 09:15',
        timestamp: '13 Jul 2026, 09:15',
        userEmail: 'john@example.com',
        userName: 'John Customer',
        deliveryAddress: {
          id: 'addr-1',
          label: 'Home',
          street: '12 Oak Avenue',
          suburb: 'Rivonia',
          city: 'Johannesburg',
          code: '2128',
          isDefault: true,
        },
      },
      {
        id: 'ORD-1229',
        items: [
          { id: '10', name: 'BBQ Chicken Pizza', price: 135, category: 'CIAO ITALY', quantity: 1, selectedSize: 'Large' },
          { id: '11', name: 'Caesar Salad', price: 80, category: 'SALADS & BOWLS', quantity: 1 },
          { id: '12', name: 'Garlic Bread', price: 35, category: 'SIDES & SAUCES', quantity: 2 },
        ],
        total: 285,
        totalPrice: 285,
        status: 'delivered',
        date: '12 Jul 2026, 18:30',
        timestamp: '12 Jul 2026, 18:30',
        userEmail: 'jane@example.com',
        userName: 'Jane Smith',
        deliveryAddress: {
          id: 'addr-2',
          label: 'Work',
          street: '45 Maude Street',
          suburb: 'Sandton',
          city: 'Johannesburg',
          code: '2196',
          isDefault: true,
        },
      },
    ];
    
    setAllUsers(demoUsers);
    setOrders(demoOrders);
    setDiscounts([
      { id: '1', code: 'WELCOME10', percentage: 10, active: true, expires: '31 Dec 2026' },
      { id: '2', code: 'SAVE20', percentage: 20, active: true, expires: '30 Aug 2026' },
    ]);
  }, []);

  const login = (email: string, role: string, name?: string, accountType?: AccountType, companyName?: string) => {
    const newUser = { email, role, name: name || email.split('@')[0], accountType, companyName };
    setUser(newUser);

    // Track this user in allUsers for admin view
    setAllUsers(prev => {
      const exists = prev.find(u => u.email === email);
      if (exists) {
        return prev.map(u =>
          u.email === email ? { ...u, orderCount: u.orderCount } : u
        );
      }
      return [...prev, {
        id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
        email,
        role,
        name: name || email.split('@')[0],
        accountType,
        companyName,
        joinedDate: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
        orderCount: 0,
      }];
    });
  };

  const logout = () => {
    setUser(null);
    setCart([]);
    setAppliedDiscount(null);
  };

  // Auto-apply the best matching discount whenever cart, discounts, or user changes
  useEffect(() => {
    if (cart.length === 0) {
      setAppliedDiscount(null);
      return;
    }

    const now = new Date();
    const validDiscounts = discounts.filter(d => {
      if (!d.active) return false;
      if (d.expires && new Date(d.expires) < now) return false;
      return true;
    });

    // Find the best discount that matches items in cart
    let bestDiscount: Discount | null = null;
    for (const d of validDiscounts) {
      const hasEligibleItem = cart.some(item => {
        if (d.itemName) return item.name.toLowerCase() === d.itemName.toLowerCase();
        if (d.categoryId) return item.category.toLowerCase() === d.categoryId.toLowerCase();
        if (d.company) return user?.companyName?.toLowerCase() === d.company.toLowerCase();
        return true; // global
      });
      if (hasEligibleItem) {
        if (!bestDiscount || d.percentage > bestDiscount.percentage) {
          bestDiscount = d;
        }
      }
    }

    setAppliedDiscount(bestDiscount);
  }, [cart, discounts, user]);

  const addToCart = (newItem: CartItem) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === newItem.id);
      if (existing) {
        return prevCart.map(item =>
          item.id === newItem.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...newItem, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prevCart =>
      prevCart
        .map(item => (item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter(item => item.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setAppliedDiscount(null);
  };

  const placeOrder = (deliveryAddress?: DeliveryAddress) => {
    if (cart.length === 0) return;
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = calculateDiscountAmount(cart, appliedDiscount);
    const finalTotal = totalAmount - discountAmount;
    const nowStr = new Date().toLocaleString();

    const newOrder: Order = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      items: [...cart],
      total: finalTotal,
      totalPrice: totalAmount,
      status: 'pending',
      date: nowStr,
      timestamp: nowStr,
      userEmail: user?.email,
      userName: user?.name,
      deliveryAddress: deliveryAddress,
      note: orderNote || undefined,
      discount: appliedDiscount || undefined,
      discountAmount: discountAmount || undefined,
    };
    setOrders(prev => [newOrder, ...prev]);
    
    // Increment user order count
    if (user?.email) {
      setAllUsers(prev =>
        prev.map(u =>
          u.email === user.email ? { ...u, orderCount: u.orderCount + 1 } : u
        )
      );
    }
    
    setOrderNote(''); // Clear note after order is placed
    setAppliedDiscount(null); // Clear discount after order
    clearCart();
  };

  const addMenuItem = (categoryId: string, item: any) => {
    setMenus(prev => prev.map(cat => 
      cat.id === categoryId 
        ? { ...cat, items: [...cat.items, { ...item, id: `item-${Date.now()}` }] }
        : cat
    ));
  };

  const updateMenuItem = (categoryId: string, itemId: string, item: any) => {
    setMenus(prev => prev.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: cat.items.map(i => i.id === itemId ? { ...i, ...item } : i) }
        : cat
    ));
  };

  const deleteMenuItem = (categoryId: string, itemId: string) => {
    setMenus(prev => prev.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: cat.items.filter(i => i.id !== itemId) }
        : cat
    ));
  };

  const addDiscount = (discount: Discount) => {
    setDiscounts(prev => [...prev, { ...discount, id: `disc-${Date.now()}` }]);
  };

  // Check if a cart item is eligible for a specific discount
  const isItemEligibleForDiscount = (item: CartItem, discount: Discount | null): boolean => {
    if (!discount) return false;
    // If discount has specific itemName, only apply to items with matching name
    if (discount.itemName) {
      return item.name.toLowerCase() === discount.itemName.toLowerCase();
    }
    // If discount has categoryId, only apply to items in that category
    if (discount.categoryId) {
      return item.category.toLowerCase() === discount.categoryId.toLowerCase();
    }
    // If discount has company, only apply to items from that company (match on category)
    if (discount.company) {
      return item.category.toLowerCase().includes(discount.company.toLowerCase());
    }
    // No targeting specified - apply to all items (global discount)
    return true;
  };

  // Calculate total discount amount for eligible items only
  const calculateDiscountAmount = (cartItems: CartItem[], discount: Discount | null): number => {
    if (!discount) return 0;
    const eligibleTotal = cartItems
      .filter(item => isItemEligibleForDiscount(item, discount))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
    return eligibleTotal * discount.percentage / 100;
  };

  const updateDiscount = (discountId: string, discount: Partial<Discount>) => {
    setDiscounts(prev => prev.map(d => d.id === discountId ? { ...d, ...discount } : d));
  };

  const deleteDiscount = (discountId: string) => {
    setDiscounts(prev => prev.filter(d => d.id !== discountId));
  };

  const addUser = (newUser: AppUser) => {
    setAllUsers(prev => [...prev, newUser]);
  };

  const updateUser = (userId: string, updates: Partial<AppUser>) => {
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
  };

  const deleteUser = (userId: string) => {
    setAllUsers(prev => prev.filter(u => u.id !== userId));
  };

  // Delivery address management
  const addAddress = (address: DeliveryAddress) => {
    setSavedAddresses(prev => {
      // If this is the first address, make it default
      if (prev.length === 0) {
        return [{ ...address, isDefault: true }];
      }
      // If this new address is set as default, unset others
      if (address.isDefault) {
        return [...prev.map(a => ({ ...a, isDefault: false })), address];
      }
      return [...prev, address];
    });
  };

  const removeAddress = (addressId: string) => {
    setSavedAddresses(prev => {
      const filtered = prev.filter(a => a.id !== addressId);
      // If we removed the default, make the first remaining one default
      if (filtered.length > 0 && !filtered.some(a => a.isDefault)) {
        filtered[0].isDefault = true;
      }
      return filtered;
    });
  };

  const setDefaultAddress = (addressId: string) => {
    setSavedAddresses(prev =>
      prev.map(a => ({ ...a, isDefault: a.id === addressId }))
    );
  };

  // Card management functions
  const saveCard = (card: Omit<SavedCard, 'id' | 'createdAt'>) => {
    const newCard: SavedCard = {
      ...card,
      id: `card-${Date.now()}`,
      createdAt: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
    setSavedCards(prev => [newCard, ...prev]);
  };

  const removeCard = (cardId: string) => {
    setSavedCards(prev => prev.filter(card => card.id !== cardId));
  };

  return (
    <KitchenCoContext.Provider
      value={{
        user,
        cart,
        orders,
        activeWeek,
        setActiveWeek,
        login,
        logout,
        addToCart,
        removeFromCart,
        clearCart,
        placeOrder,
        allUsers,
        menus,
        discounts,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        addDiscount,
        updateDiscount,
        deleteDiscount,
        addUser,
        updateUser,
        deleteUser,
        savedAddresses,
        addAddress,
        removeAddress,
        setDefaultAddress,
        savedCards,
        saveCard,
        removeCard,
        orderNote,
        setOrderNote,
        appliedDiscount,
        setAppliedDiscount,
        theme,
        isItemEligibleForDiscount,
        calculateDiscountAmount,
      }}
    >
      {children}
    </KitchenCoContext.Provider>
  );
}

export function useKitchen() {
  const context = useContext(KitchenCoContext);
  if (!context) throw new Error('useKitchen must be used within a KitchenProvider');
  return context;
}