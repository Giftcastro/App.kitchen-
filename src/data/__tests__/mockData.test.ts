import {
  WHITELISTED_COMPANY_DOMAINS,
  INITIAL_CORPORATE_ACCOUNTS,
  MENU_ITEMS,
  MENU_CATEGORIES,
  EIGHT_WEEK_CYCLE_DATA,
  DROPOFF_FLOORS,
  getCycleWeekForDate,
} from '../mockData';

describe('mockData consistency', () => {
  it('whitelisted company domains have valid properties', () => {
    expect(WHITELISTED_COMPANY_DOMAINS.length).toBeGreaterThan(0);
    WHITELISTED_COMPANY_DOMAINS.forEach(company => {
      expect(company.domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/i);
      expect(company.companyName.length).toBeGreaterThan(0);
      expect(company.isActive).toBe(true);
    });
  });

  it('corporate accounts have valid configurations', () => {
    expect(INITIAL_CORPORATE_ACCOUNTS.length).toBeGreaterThan(0);
    INITIAL_CORPORATE_ACCOUNTS.forEach(account => {
      expect(account.companyName.length).toBeGreaterThan(0);
      expect(account.domains.length).toBeGreaterThan(0);
      expect(account.locations.length).toBeGreaterThan(0);
    });
  });

  it('menu items have valid prices, names, and assigned categories', () => {
    expect(MENU_ITEMS.length).toBeGreaterThan(0);
    MENU_ITEMS.forEach(item => {
      expect(item.id).toBeTruthy();
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.price).toBeGreaterThan(0);
      expect(item.categoryId).toBeTruthy();
    });
  });

  it('menu categories are defined with valid keys and titles', () => {
    expect(MENU_CATEGORIES.length).toBeGreaterThanOrEqual(14);
    MENU_CATEGORIES.forEach(cat => {
      expect(cat.id).toBeTruthy();
      expect(cat.name.length).toBeGreaterThan(0);
    });
  });

  it('eight-week cycle plans contain weeks 1 through 8 with 5 weekdays each', () => {
    expect(EIGHT_WEEK_CYCLE_DATA.length).toBe(8);
    EIGHT_WEEK_CYCLE_DATA.forEach((plan, index) => {
      expect(plan.week).toBe(index + 1);
      expect(plan.days.length).toBe(5);
      plan.days.forEach(day => {
        expect(day.day).toBeTruthy();
        expect(day.main_meal.length).toBeGreaterThan(0);
      });
    });
  });

  it('getCycleWeekForDate calculates cycle week in range 1-8', () => {
    const cycle1 = getCycleWeekForDate(1, '2026-09-07');
    expect(cycle1).toBeGreaterThanOrEqual(1);
    expect(cycle1).toBeLessThanOrEqual(8);
  });

  it('dropoff floors are properly configured', () => {
    expect(DROPOFF_FLOORS.length).toBeGreaterThan(0);
    DROPOFF_FLOORS.forEach(floor => {
      expect(floor.id).toBeTruthy();
      expect(floor.label.length).toBeGreaterThan(0);
    });
  });
});
