/**
 * Object navigation parameters — MAUI's
 * `Shell.Current.GoToAsync(route, new Dictionary<string, object> { ... })`.
 * The caller stores the object, then pushes the route; the destination page
 * reads it once on mount. Kept outside React state on purpose: these are
 * one-shot hand-offs between two pages, not app state anything re-renders on.
 */
import type { Order, Product } from '../models';

interface NavParams {
  SelectedProduct?: Product;
  Orders?: Order[];
  Order?: Order;
  /** Payment page: amount due and delivery fee, as MAUI's query string carries them. */
  Payment?: { amountDue: number; deliveryFee: number; addressId: string };
}

const params: NavParams = {};

export function setNavParam<K extends keyof NavParams>(key: K, value: NavParams[K]): void {
  params[key] = value;
}

export function getNavParam<K extends keyof NavParams>(key: K): NavParams[K] {
  return params[key];
}
