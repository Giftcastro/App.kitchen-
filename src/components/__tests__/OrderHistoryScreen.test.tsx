import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { OrderHistoryScreen } from '../../screens/OrderHistoryScreen';
import { MOCK_ORDER_HISTORY } from '../../data/mockData';

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock expo-blur
jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

// Mock useTheme
jest.mock('../../theme/ThemeContext', () => {
  const { lightColors } = require('../../theme');
  return {
    useTheme: () => ({
      theme: lightColors,
      themeMode: 'light',
      isDark: false,
    }),
  };
});

// Mock useAuth
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      id: 'usr_alex',
      fullName: 'Alex Van Der Berg',
      email: 'alex.vanderberg@intellectdesign.com',
      companyId: 'comp_intellect',
      companyName: 'Intellect Design Arena',
      deliveryFloor: 'Floor 3 (Reception Pantry)',
      hasPromptedDeliveryDate: true,
      markDeliveryDatePrompted: jest.fn(),
    },
  }),
}));

// Mock useCart
jest.mock('../../context/CartContext', () => ({
  useCart: () => ({
    orderHistory: MOCK_ORDER_HISTORY,
    submitOrderRating: jest.fn(),
    reportOrderNonDelivery: jest.fn(),
  }),
}));

describe('OrderHistoryScreen', () => {
  it('renders order history screen with categorized tabs', () => {
    let component: renderer.ReactTestRenderer | undefined;
    act(() => {
      component = renderer.create(
        <OrderHistoryScreen
          onNavigateToMenu={jest.fn()}
          onNavigateToTracker={jest.fn()}
        />
      );
    });

    expect(component).toBeDefined();
    const json = JSON.stringify(component?.toJSON());
    expect(json).toContain("Today's Lunch");
    expect(json).toContain('Upcoming');
    expect(json).toContain('Past Orders');
  });

  it('renders 8:00 AM SAST Briefing banner when today orders exist', () => {
    let component: renderer.ReactTestRenderer | undefined;
    act(() => {
      component = renderer.create(
        <OrderHistoryScreen
          onNavigateToMenu={jest.fn()}
          onNavigateToTracker={jest.fn()}
        />
      );
    });

    const json = JSON.stringify(component?.toJSON());
    expect(json).toContain('8:00 AM SAST BRIEFING');
    expect(json).toContain("Today's Lunch Drop is Confirmed");
  });
});
