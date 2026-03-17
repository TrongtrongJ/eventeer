import type { DiscountType } from "@event-mgmt/shared-schemas";

const validCodeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function generateRandomCouponCode() {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += validCodeChars.charAt(Math.floor(Math.random() * validCodeChars.length));
  }
  return code;
};

export function formatDiscountText(discountType: DiscountType, discountValue: number) {
  return discountType === 'PERCENTAGE' ? `${discountValue}% off` : `$${discountValue} off`
}