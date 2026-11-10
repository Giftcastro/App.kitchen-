import { OrderHistoryItem, OrderStatus } from '../../types';
import {
  addDaysIso,
  fulfilmentRate,
  getTodayIsoSAST,
  isActiveOrder,
  isInTimeframe,
  mealsAndOrdersLabel,
  monthToDateSales,
  ordersWithoutMeals,
  sumMeals,
  sumRevenue,
  upcomingSales,
} from '../adminMetrics';

const order = (status: OrderStatus, date: string, quantities: number[], total: number): OrderHistoryItem =>
  ({
    status,
    targetDeliveryDate: date,
    totalPaid: total,
    items: quantities.map((quantity) => ({ quantity })),
  }) as unknown as OrderHistoryItem;

// The five orders on production when the Overview numbers were questioned.
const PRODUCTION = [
  order('delivered', '2026-10-28', [2, 1], 363.4),
  order('delivered', '2026-11-05', [1], 172),
  order('paid_scheduled', '2026-11-10', [1], 172),
  order('paid_scheduled', '2026-11-11', [], 172),
  order('paid_scheduled', '2026-11-11', [1], 194.5),
];

const TODAY = '2026-11-09';

describe('admin metrics', () => {
  afterEach(() => jest.useRealTimers());

  it('explains 4 delivered meals across 2 delivered orders', () => {
    expect(mealsAndOrdersLabel(PRODUCTION.filter((o) => o.status === 'delivered'))).toBe('4 meals · 2 orders');
  });

  it('explains 2 preparing meals across 3 preparing orders', () => {
    const preparing = PRODUCTION.filter(isActiveOrder);
    expect(mealsAndOrdersLabel(preparing)).toBe('2 meals · 3 orders');
    expect(ordersWithoutMeals(PRODUCTION)).toHaveLength(1);
  });

  it('uses singular words for one', () => {
    expect(mealsAndOrdersLabel([order('delivered', TODAY, [1], 10)])).toBe('1 meal · 1 order');
  });

  it('counts quantities, not item rows', () => {
    expect(sumMeals([order('delivered', TODAY, [2, 3], 10)])).toBe(5);
  });

  it('adds revenue', () => {
    expect(sumRevenue(PRODUCTION)).toBeCloseTo(1073.9);
  });

  it('leaves future deliveries out of month to date', () => {
    expect(sumRevenue(monthToDateSales(PRODUCTION, TODAY))).toBe(172);
  });

  it('leaves cancelled orders out of sales', () => {
    const orders = [order('cancelled', TODAY, [1], 100), order('paid_scheduled', TODAY, [1], 50)];
    expect(sumRevenue(monthToDateSales(orders, TODAY))).toBe(50);
    expect(upcomingSales(orders, TODAY)).toHaveLength(1);
  });

  it('counts only undelivered orders as active', () => {
    const statuses: OrderStatus[] = ['delivered', 'cancelled', 'unfulfilled'];
    statuses.forEach((s) => expect(isActiveOrder(order(s, TODAY, [1], 1))).toBe(false));
    expect(isActiveOrder(order('out_for_delivery', TODAY, [1], 1))).toBe(true);
  });

  it('uses the South African date just after midnight there', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-09T22:30:00Z'));
    expect(getTodayIsoSAST()).toBe('2026-11-10');
  });

  it('adds days across a month end', () => {
    expect(addDaysIso('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('applies each report period', () => {
    // 9 November 2026 is a Monday.
    expect(isInTimeframe('2026-11-09', 'Today', TODAY)).toBe(true);
    expect(isInTimeframe('2026-11-10', 'Today', TODAY)).toBe(false);
    expect(isInTimeframe('2026-11-15', 'This Week', TODAY)).toBe(true);
    expect(isInTimeframe('2026-11-16', 'This Week', TODAY)).toBe(false);
    expect(isInTimeframe('2026-11-08', 'This Week', TODAY)).toBe(false);
    expect(isInTimeframe('2026-11-30', 'This Month', TODAY)).toBe(true);
    expect(isInTimeframe('2026-10-31', 'This Month', TODAY)).toBe(false);
    expect(isInTimeframe('2026-10-11', 'Last 30 Days', TODAY)).toBe(true);
    expect(isInTimeframe('2026-10-10', 'Last 30 Days', TODAY)).toBe(false);
    expect(isInTimeframe('2026-11-10', 'Last 30 Days', TODAY)).toBe(false);
  });

  it('calculates fulfilment from real outcomes only', () => {
    expect(fulfilmentRate([])).toBeNull();
    expect(fulfilmentRate([order('paid_scheduled', TODAY, [1], 1)])).toBeNull();
    expect(
      fulfilmentRate([
        order('delivered', TODAY, [1], 1),
        order('delivered', TODAY, [1], 1),
        order('delivered', TODAY, [1], 1),
        order('unfulfilled', TODAY, [1], 1),
      ])
    ).toBe(75);
  });
});
