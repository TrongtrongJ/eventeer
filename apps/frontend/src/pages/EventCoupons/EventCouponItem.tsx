import { CouponDto } from '@event-mgmt/shared-schemas';
import React from 'react';
import { addToast } from '../../store/slices/ui';
import { 
  formatDiscountText, 
  formatExpirationDate, 
  getCouponActiveStatusClass, 
  getCouponExpirationDateClass, 
  getCouponsUsagePercentage, 
  getCouponsUsagePercentageClass 
} from './helpers';
import { useUpdateCouponMutation } from '../../store/slices/coupons/couponsApi';
import { useAppDispatch } from '../../store/hooks';

interface EventCouponItemProps {
  coupon: CouponDto;
};

const EventCouponItem: React.FC<EventCouponItemProps> = ({ coupon }) => {
  const { 
    id, 
    code, 
    isActive, 
    discountType, 
    discountValue, 
    currentUsages, 
    maxUsages,
    expiresAt,
    minPurchaseAmount,
  } = coupon;

  const dispatch = useAppDispatch();

  const [updateCoupon, { data: couponData, isLoading, isError }] = useUpdateCouponMutation();

  const toggleCouponStatus = async () => {
    await updateCoupon({ id, isActive: !isActive }).unwrap();
  };

  const couponDiscountText = formatDiscountText(discountType, discountValue);

  const couponUsageBarWidth = Math.min(getCouponsUsagePercentage(coupon.currentUsages, coupon.maxUsages), 100);

  const couponExpirationDateText = formatExpirationDate(expiresAt);

  const couponExpirationDateClass = getCouponExpirationDateClass(expiresAt);

  const hasMinPurchaseAmount = minPurchaseAmount && minPurchaseAmount > 0;

  const couponStatusClass = getCouponActiveStatusClass(isActive);

  const couponCodeCopyHandler = useCallback(() => {
    navigator.clipboard.writeText(code);
    dispatch(addToast({ message: 'Coupon Code copied!', type: 'success' }));
  }, [code, dispatch, navigator])

  return (
    <div key={id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-2xl font-bold font-mono text-indigo-600">
                {code}
              </h3>
              {!isActive && (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-lg font-semibold text-green-600">
              {couponDiscountText}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-gray-600 mb-4">
          <div className="flex justify-between">
            <span>Uses:</span>
            <span className="font-semibold">
              {currentUsages} / {maxUsages}
            </span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                getCouponsUsagePercentageClass(coupon.currentUsages, coupon.maxUsages)
              }`}
              style={{ width: `${couponUsageBarWidth}%` }}
            />
          </div>

          <div className="flex justify-between">
            <span>Expires:</span>
            <span className={`font-semibold ${couponExpirationDateClass}`}>
              {couponExpirationDateText}
            </span>
          </div>

          {hasMinPurchaseAmount && (
            <div className="flex justify-between">
              <span>Min. purchase:</span>
              <span className="font-semibold">
                ${minPurchaseAmount}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggleCouponStatus}
            className={`flex-1 px-4 py-2 rounded-md font-semibold ${
              couponStatusClass
            }`}
          >
            {coupon.isActive ? 'Deactivate' : 'Activate'}
          </button>
          
          <button
            onClick={couponCodeCopyHandler}
            className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200 font-semibold"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventCouponItem;