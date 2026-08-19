// src/utils/deliveryHelpers.ts

export interface DeliveryEstimate {
  isAfterCutoff: boolean;
  minutesLeft: number;
  formattedDate: string;
}

export function getEstimatedDelivery(now: Date = new Date()): DeliveryEstimate {
  const delivery = new Date(now);
  const hour = now.getHours();
  const minutes = now.getMinutes();
  
  // Cutoff is 11:00 AM
  const isAfterCutoff = hour > 11 || (hour === 11 && minutes >= 0);
  
  // 1. Determine baseline business days needed (2 if before 11 AM, 3 if after)
  const businessDaysRequired = isAfterCutoff ? 3 : 2;

  let addedDays = 0;
  while (addedDays < businessDaysRequired) {
    delivery.setDate(delivery.getDate() + 1);
    const dayOfWeek = delivery.getDay(); // 0 = Sun, 6 = Sat
    // Only count Monday to Friday as business days
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }

  // Calculate minutes remaining if it is before 11:00 AM
  let minutesLeftToCutoff = 0;
  if (!isAfterCutoff) {
    const cutoffTime = new Date(now);
    cutoffTime.setHours(11, 0, 0, 0);
    minutesLeftToCutoff = Math.floor((cutoffTime.getTime() - now.getTime()) / 60000);
  }

  return {
    isAfterCutoff,
    minutesLeft: minutesLeftToCutoff,
    formattedDate: delivery.toLocaleDateString('en-ZA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  };
}