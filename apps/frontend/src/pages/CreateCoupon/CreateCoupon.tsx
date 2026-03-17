import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateCouponDto, CreateCouponSchema } from '@event-mgmt/shared-schemas';
import { useCreateCouponMutation } from '../../store/slices/coupons/couponsApi';
import { useGetEventByIdQuery } from '../../store/slices/events/eventsApi';
import SpinnerLoader from '../../components/Loader/SpinnerLoader';
import EmptyList from '../../components/EmptyList';
import { formatDiscountText, generateRandomCouponCode } from './helpers';

const CreateCoupon: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const { 
    data: event, 
    isLoading: isLoadingEvent, 
    isError: isEventError 
  } = useGetEventByIdQuery(eventId!, {
    skip: !eventId
  });

  const [createCoupon, { data, isLoading, isError }] = useCreateCouponMutation()

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCouponDto>({
    resolver: zodResolver(CreateCouponSchema),
    defaultValues: { 
      code: '',
      eventId: eventId || '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUsages: 100,
      expiresAt: '',
      minPurchaseAmount: 0,
    },
  });

  const setRandomCouponCode = useCallback(() => {
    setValue('code', generateRandomCouponCode())
  }, [setValue])

  const onSubmit = async (data: CreateCouponDto) => {
    try {
      const newCoupon = await createCoupon(data).unwrap();
    } catch (err) {
      console.error('Failed to create coupon:', err);
    }
  };

  if (isLoadingEvent) {
    return (<SpinnerLoader />);
  };

  if (!event) {
    return (
      <EmptyList message='Cannot find an event with specified eventId!' />
    );
  };

  const discountType = watch('discountType');
  const discountValue = watch('discountValue');
  const discountUnit = discountType === 'PERCENTAGE' ? '%' : '$';
  const formattedDiscountText = formatDiscountText(discountType, discountValue);
  const couponCode = watch('code')
  const maxUsages = watch('maxUsages')
  const minPurchaseAmount = watch('minPurchaseAmount')

  const hasMinPurchaseAmount = minPurchaseAmount != null && minPurchaseAmount > 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/events/${eventId}/coupons`)}
          className="text-indigo-600 hover:text-indigo-800 flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Coupons
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Coupon</h1>
        <p className="text-gray-600 mb-6">For: {event.title}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coupon Code *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                maxLength={50}
                {...register('code')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 uppercase"
                placeholder="SUMMER2025"
              />
              <button
                type="button"
                onClick={setRandomCouponCode}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Generate
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Letters and numbers only, will be converted to uppercase
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Type *
              </label>
              <select
                required
                {...register('discountType')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount ($)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Value *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  {...register('discountValue', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2 text-gray-500">
                  {discountUnit}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Uses *
              </label>
              <input
                type="number"
                required
                min="1"
                max="10000"
                {...register('maxUsages', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Total number of times this coupon can be used
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiration Date *
              </label>
              <input
                type="datetime-local"
                required
                {...register('expiresAt', { valueAsDate: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Purchase Amount (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                {...register('minPurchaseAmount', { valueAsNumber: true })}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Leave at 0 for no minimum requirement
            </p>
          </div>

          {/* Preview */}
          <div className="bg-indigo-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Preview</h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p>
                Code: <span className="font-mono font-bold">{couponCode || 'XXXXX'}</span>
              </p>
              <p>
                Discount: <span className="font-semibold text-green-600">
                  {formattedDiscountText}
                </span>
              </p>
              <p>Available uses: {maxUsages}</p>
              {hasMinPurchaseAmount && (
                <p>Minimum purchase: ${minPurchaseAmount}</p>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isLoading ? 'Creating...' : 'Create Coupon'}
            </button>
            
            <button
              type="button"
              onClick={() => navigate(`/events/${eventId}/coupons`)}
              className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md hover:bg-gray-300 transition-colors font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export { CreateCoupon };