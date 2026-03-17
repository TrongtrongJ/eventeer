import { DiscountType } from "@event-mgmt/shared-schemas";
export function getCouponsUsagePercentage(current: number, max: number) {
  return Math.round((current / max) * 100);
};

export function getCouponsUsagePercentageClass(current: number, max: number) {
  const usagePercentage = getCouponsUsagePercentage(current, max);
  if (usagePercentage >= 100) return 'bg-red-500';
  if (usagePercentage >= 80) return 'bg-yellow-500';
  return 'bg-green-500';
};

export function formatDiscountText(discountType: DiscountType, discountValue: number) {
  return discountType === 'PERCENTAGE' ? `${discountValue}% off` : `$${discountValue} off`;
};

export function getCouponExpirationDateClass(expiresAt: Date | string) {
  return new Date(expiresAt) < new Date() ? 'text-red-600' : '';
};

export function formatExpirationDate(expiresAt: Date | string) {
  return new Date(expiresAt).toLocaleDateString();
};

export function getCouponActiveStatusClass(isActive: boolean) {
  return isActive
    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    : 'bg-green-600 text-white hover:bg-green-700';
};