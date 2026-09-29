'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CreateCouponDto, CreateCouponSchema } from '@packages/shared-schemas';
import { orpc } from '@/lib/orpc/query';
import { useToast } from '@/lib/toast/toast-context';
import SpinnerLoader from '@/components/Loader/SpinnerLoader';
import EmptyList from '@/components/EmptyList';
import { formatDiscountText, generateRandomCouponCode } from './helpers';

export function CreateCouponClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { data: eventData, isLoading: isLoadingEvent } = useQuery(
    orpc.events.findOne.queryOptions({ input: { id: eventId } }),
  );
  const event = eventData?.data;

  const createCouponMutation = useMutation(orpc.coupons.createCoupon.mutationOptions());

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
      eventId,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUsages: 100,
      expiresAt: '',
      minPurchaseAmount: 0,
      eventTicketPrice: 0,
    },
  });

  // The form mounts before the event query resolves, so defaultValues can't
  // know the ticket price yet - sync it in once the event loads.
  useEffect(() => {
    if (event) setValue('eventTicketPrice', event.ticketPrice);
  }, [event, setValue]);

  const setRandomCouponCode = useCallback(() => {
    setValue('code', generateRandomCouponCode());
  }, [setValue]);

  const onSubmit = useCallback(
    async (data: CreateCouponDto) => {
      try {
        await createCouponMutation.mutateAsync(data);
        await queryClient.invalidateQueries({ queryKey: orpc.coupons.key() });
        addToast({ message: 'Coupon created successfully!', type: 'success' });
        router.push(`/events/${eventId}/coupons`);
      } catch (err: any) {
        addToast({ message: err?.message || 'Failed to create coupon', type: 'error' });
      }
    },
    [createCouponMutation, addToast, router, eventId, queryClient],
  );

  if (isLoadingEvent) {
    return <SpinnerLoader />;
  }

  if (!event) {
    return <EmptyList message="Cannot find an event with specified eventId!" />;
  }

  const discountType = watch('discountType');
  const discountValue = watch('discountValue');
  const discountUnit = discountType === 'PERCENTAGE' ? '%' : '$';
  const formattedDiscountText = formatDiscountText(discountType, discountValue);
  const couponCode = watch('code');
  const maxUsages = watch('maxUsages');
  const minPurchaseAmount = watch('minPurchaseAmount');
  const hasMinPurchaseAmount = minPurchaseAmount != null && minPurchaseAmount > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => router.push(`/events/${eventId}/coupons`)}
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
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">Coupon Code *</label>
            <div className="flex gap-2">
              <input
                id="code"
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
            <p className="text-xs text-gray-500 mt-1">Letters and numbers only, will be converted to uppercase</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="discountType" className="block text-sm font-medium text-gray-700 mb-1">Discount Type *</label>
              <select
                id="discountType"
                required
                {...register('discountType')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount ($)</option>
              </select>
            </div>

            <div>
              <label htmlFor="discountValue" className="block text-sm font-medium text-gray-700 mb-1">Discount Value *</label>
              <div className="relative">
                <input
                  id="discountValue"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  {...register('discountValue', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2 text-gray-500">{discountUnit}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maxUsages" className="block text-sm font-medium text-gray-700 mb-1">Max Uses *</label>
              <input
                id="maxUsages"
                type="number"
                required
                min="1"
                max="10000"
                {...register('maxUsages', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Total number of times this coupon can be used</p>
            </div>

            <div>
              <label htmlFor="expiresAt" className="block text-sm font-medium text-gray-700 mb-1">Expiration Date *</label>
              <input
                id="expiresAt"
                type="datetime-local"
                required
                {...register('expiresAt', {
                  setValueAs: (v) => (v ? new Date(v).toISOString() : v),
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="minPurchaseAmount" className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Purchase Amount (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                id="minPurchaseAmount"
                type="number"
                min="0"
                step="0.01"
                {...register('minPurchaseAmount', { valueAsNumber: true })}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Leave at 0 for no minimum requirement</p>
          </div>

          <div className="bg-indigo-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Preview</h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p>
                Code: <span className="font-mono font-bold">{couponCode || 'XXXXX'}</span>
              </p>
              <p>
                Discount: <span className="font-semibold text-green-600">{formattedDiscountText}</span>
              </p>
              <p>Available uses: {maxUsages}</p>
              {hasMinPurchaseAmount && <p>Minimum purchase: ${minPurchaseAmount}</p>}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={createCouponMutation.isPending}
              className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {createCouponMutation.isPending ? 'Creating...' : 'Create Coupon'}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/events/${eventId}/coupons`)}
              className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md hover:bg-gray-300 transition-colors font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
