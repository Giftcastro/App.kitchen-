import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { DeliveryDateModal } from '../DeliveryDateModal';
import { generateWeekdayOptions } from '../../utils/sastTime';

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock expo-blur
jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

// Mock useTheme hook
jest.mock('../../theme/ThemeContext', () => {
  const { darkColors } = require('../../theme');
  return {
    useTheme: () => ({
      theme: darkColors,
      themeMode: 'dark',
      isDark: true,
    }),
  };
});

describe('DeliveryDateModal Component', () => {
  // Reference date: Friday Sep 4, 2026 at 8:00 AM (so next 10 days are available)
  const mockOptions = generateWeekdayOptions(new Date(2026, 8, 4, 8, 0, 0), 10);

  it('renders modal with weekday options', () => {
    let component: renderer.ReactTestRenderer | undefined;
    act(() => {
      component = renderer.create(
        <DeliveryDateModal
          visible={true}
          selectedDate="2026-09-07"
          deliveryDates={mockOptions}
          onConfirm={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    expect(component).toBeDefined();
    const tree = component?.toJSON();
    expect(tree).toBeTruthy();
  });

  it('selects date and calls onConfirm with chosen date', () => {
    const onConfirmMock = jest.fn();
    let component: renderer.ReactTestRenderer | undefined;
    act(() => {
      component = renderer.create(
        <DeliveryDateModal
          visible={true}
          selectedDate="2026-09-07"
          deliveryDates={mockOptions}
          onConfirm={onConfirmMock}
          onClose={jest.fn()}
        />
      );
    });

    const root = component?.root;
    // Find the second available weekday card
    const targetDate = mockOptions[1].dateString;
    const targetPill = root?.findByProps({ testID: `date-pill-${targetDate}` });

    expect(targetPill).toBeDefined();
    act(() => {
      targetPill?.props.onPress();
    });

    const confirmButton = root?.findByProps({ testID: 'confirm-date-button' });
    expect(confirmButton).toBeDefined();
    act(() => {
      confirmButton?.props.onPress();
    });

    expect(onConfirmMock).toHaveBeenCalledWith(targetDate);
  });
});
