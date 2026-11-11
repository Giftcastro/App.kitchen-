import { useState, useEffect, useMemo, useCallback, useSyncExternalStore } from 'react';
import { DeliveryDateOption } from '../types';
import { generate14WeekdayOptions, getNowInSAST } from '../utils/sastTime';

// The chosen delivery day is one value for the whole app. Kept per hook instance, the menu
// and checkout each had their own and disagreed about which day was selected.
let sharedSelectedDate = '';
const selectedDateListeners = new Set<() => void>();
const subscribeSelectedDate = (listener: () => void) => {
  selectedDateListeners.add(listener);
  return () => {
    selectedDateListeners.delete(listener);
  };
};
const getSharedSelectedDate = () => sharedSelectedDate;
const setSharedSelectedDate = (dateString: string) => {
  if (dateString === sharedSelectedDate) return;
  sharedSelectedDate = dateString;
  selectedDateListeners.forEach((listener) => listener());
};

export interface UseDeliveryCalendarResult {
  deliveryDates: DeliveryDateOption[];
  selectedDate: string;
  setSelectedDate: (dateString: string) => void;
  selectedDateOption: DeliveryDateOption | undefined;
  firstAvailableDate: DeliveryDateOption | undefined;
  cutoffNoticeText: string;
  isOrderable: boolean;
  refreshCalendar: () => void;
  currentTimeSAST: string;
}

export function useDeliveryCalendar(): UseDeliveryCalendarResult {
  const [deliveryDates, setDeliveryDates] = useState<DeliveryDateOption[]>(() =>
    generate14WeekdayOptions(undefined, 14)
  );

  const firstAvailable = useMemo(() => {
    return deliveryDates.find((d) => d.isAvailable && !d.isLocked) || deliveryDates[0];
  }, [deliveryDates]);

  const storedSelectedDate = useSyncExternalStore(
    subscribeSelectedDate,
    getSharedSelectedDate,
    getSharedSelectedDate
  );
  const selectedDate = storedSelectedDate || (firstAvailable ? firstAvailable.dateString : '');
  const setSelectedDate = setSharedSelectedDate;

  const refreshCalendar = useCallback(() => {
    const updated = generate14WeekdayOptions(undefined, 14);
    setDeliveryDates(updated);
  }, []);

  // Update selected date if it becomes empty, uninitialized, or locked
  useEffect(() => {
    const currentOpt = deliveryDates.find((d) => d.dateString === selectedDate);
    if ((!selectedDate || !currentOpt || currentOpt.isLocked || !currentOpt.isAvailable) && firstAvailable) {
      setSelectedDate(firstAvailable.dateString);
    }
  }, [selectedDate, deliveryDates, firstAvailable]);

  // Periodic refresh every 60 seconds to maintain live SAST 9:00 AM cutoff accuracy
  useEffect(() => {
    const interval = setInterval(() => {
      refreshCalendar();
    }, 60000);

    return () => clearInterval(interval);
  }, [refreshCalendar]);

  const selectedDateOption = useMemo(() => {
    const matched = deliveryDates.find((d) => d.dateString === selectedDate);
    if (matched && matched.isAvailable && !matched.isLocked) {
      return matched;
    }
    return firstAvailable || matched;
  }, [deliveryDates, selectedDate, firstAvailable]);

  const cutoffNoticeText = useMemo(() => {
    if (!selectedDateOption) return '';
    return selectedDateOption.noticeBannerText;
  }, [selectedDateOption]);

  const isOrderable = Boolean(selectedDateOption?.isAvailable);

  const currentTimeSAST = useMemo(() => {
    const now = getNowInSAST();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} SAST`;
  }, []);

  return {
    deliveryDates,
    selectedDate: selectedDateOption ? selectedDateOption.dateString : selectedDate,
    setSelectedDate,
    selectedDateOption,
    firstAvailableDate: firstAvailable,
    cutoffNoticeText,
    isOrderable,
    refreshCalendar,
    currentTimeSAST,
  };
}
