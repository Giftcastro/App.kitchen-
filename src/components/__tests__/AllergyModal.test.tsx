import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AllergyModal } from '../AllergyModal';
import { MENU_ITEMS } from '../../data/mockData';

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
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

describe('AllergyModal', () => {
  it('renders without error when dish is initially null and then updated', () => {
    let component: renderer.ReactTestRenderer | undefined;
    act(() => {
      component = renderer.create(
        <AllergyModal
          visible={false}
          dish={null}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      );
    });

    expect(component?.toJSON()).toBeNull();

    // Update props to simulate user tapping "Add" on a meal
    act(() => {
      component?.update(
        <AllergyModal
          visible={true}
          dish={MENU_ITEMS[0]}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      );
    });

    expect(component?.toJSON()).toBeTruthy();
  });

  it('excludes locked cutoff dates (e.g. Friday 11 and Monday 14) from deliver on options', () => {
    // Simulated dates matching Thursday 10 Sep after 9 AM SAST
    const mockDates = [
      {
        dateString: '2026-09-11',
        dayName: 'Fri',
        dayNumber: 11,
        monthName: 'Sep',
        year: 2026,
        fullFormattedDate: 'Friday, 11 September 2026',
        isAvailable: false,
        isLocked: true,
      },
      {
        dateString: '2026-09-14',
        dayName: 'Mon',
        dayNumber: 14,
        monthName: 'Sep',
        year: 2026,
        fullFormattedDate: 'Monday, 14 September 2026',
        isAvailable: false,
        isLocked: true,
      },
      {
        dateString: '2026-09-15',
        dayName: 'Tue',
        dayNumber: 15,
        monthName: 'Sep',
        year: 2026,
        fullFormattedDate: 'Tuesday, 15 September 2026',
        isAvailable: true,
        isLocked: false,
      },
      {
        dateString: '2026-09-16',
        dayName: 'Wed',
        dayNumber: 16,
        monthName: 'Sep',
        year: 2026,
        fullFormattedDate: 'Wednesday, 16 September 2026',
        isAvailable: true,
        isLocked: false,
      },
    ];

    let component: renderer.ReactTestRenderer | undefined;
    act(() => {
      component = renderer.create(
        <AllergyModal
          visible={true}
          dish={MENU_ITEMS[0]}
          availableDates={mockDates as any}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      );
    });

    const root = component?.root;
    // Locked dates must NOT be rendered
    const friPill = root?.findAllByProps({ testID: 'deliver-date-2026-09-11' });
    const monPill = root?.findAllByProps({ testID: 'deliver-date-2026-09-14' });
    expect(friPill?.length).toBe(0);
    expect(monPill?.length).toBe(0);

    // Available dates must be rendered
    const tuePill = root?.findByProps({ testID: 'deliver-date-2026-09-15' });
    const wedPill = root?.findByProps({ testID: 'deliver-date-2026-09-16' });
    expect(tuePill).toBeDefined();
    expect(wedPill).toBeDefined();
  });

  it("binds Chef's Choice dishes strictly to their rotation day without rendering a multi-date picker", () => {
    const chefsChoiceDish = {
      ...MENU_ITEMS[0],
      id: 'chef_1_Monday_main',
      menuType: 'chefs_choice' as const,
      categoryId: 'cat_chefs_choice',
      categoryName: "Chef's Choice • Main Meal of the Day",
    };

    const mockDates = [
      {
        dateString: '2026-09-15',
        dayName: 'Tue',
        dayNumber: 15,
        monthName: 'Sep',
        year: 2026,
        fullFormattedDate: 'Tuesday, 15 September 2026',
        isAvailable: true,
        isLocked: false,
      },
      {
        dateString: '2026-09-16',
        dayName: 'Wed',
        dayNumber: 16,
        monthName: 'Sep',
        year: 2026,
        fullFormattedDate: 'Wednesday, 16 September 2026',
        isAvailable: true,
        isLocked: false,
      },
    ];

    let component: renderer.ReactTestRenderer | undefined;
    act(() => {
      component = renderer.create(
        <AllergyModal
          visible={true}
          dish={chefsChoiceDish}
          selectedDateOption={mockDates[0] as any}
          availableDates={mockDates as any}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      );
    });

    const root = component?.root;
    // Selectable date pills must NOT be rendered for Chef's Choice
    const tuePill = root?.findAllByProps({ testID: 'deliver-date-2026-09-15' });
    const wedPill = root?.findAllByProps({ testID: 'deliver-date-2026-09-16' });
    expect(tuePill?.length).toBe(0);
    expect(wedPill?.length).toBe(0);

    // Fixed bound rotation card MUST be rendered
    const boundCard = root?.findByProps({ testID: 'chefs-choice-bound-date-card' });
    expect(boundCard).toBeDefined();
  });
});
