'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type CreateEventDto, CreateEventSchema, CreateCouponSchema } from '@packages/shared-schemas';
import { orpc } from '@/lib/orpc/query';
import { useToast } from '@/lib/toast/toast-context';

const initialFormData: CreateEventDto = {
  title: '',
  description: '',
  location: '',
  startDate: '',
  endDate: '',
  capacity: 100,
  ticketPrice: 0,
  currency: 'THB',
  imageUrl: '',
};

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500';

interface CouponForm {
  enabled: boolean;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxUsages: number;
  expiresAt: string; // datetime-local value
}

const initialCoupon: CouponForm = { enabled: false, code: '', discountType: 'PERCENTAGE', discountValue: 10, maxUsages: 50, expiresAt: '' };

export function CreateEventClient() {
  const router = useRouter();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { isValid },
  } = useForm<CreateEventDto>({
    resolver: zodResolver(CreateEventSchema),
    defaultValues: initialFormData,
  });

  const createEventMutation = useMutation(orpc.events.create.mutationOptions());
  const createCouponMutation = useMutation(orpc.coupons.createCoupon.mutationOptions());
  const [coupon, setCoupon] = useState<CouponForm>(initialCoupon);
  const patchCoupon = (patch: Partial<CouponForm>) => setCoupon((c) => ({ ...c, ...patch }));

  const onSubmit = useCallback(
    async (data: CreateEventDto) => {
      // Validate the coupon BEFORE creating the event, so a bad coupon can't leave an
      // event behind without its promotion. The event id is only known afterwards, so
      // validate against a placeholder uuid here.
      const buildCoupon = (eventId: string) => ({
        code: coupon.code,
        eventId,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        maxUsages: Number(coupon.maxUsages),
        expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString() : '',
        eventTicketPrice: Number(data.ticketPrice),
      });

      if (coupon.enabled) {
        const check = CreateCouponSchema.safeParse(buildCoupon(crypto.randomUUID()));
        if (!check.success) {
          addToast({ message: `Coupon: ${check.error.issues[0]?.message ?? 'invalid'}`, type: 'error' });
          return;
        }
      }

      try {
        const response = await createEventMutation.mutateAsync(data);
        const eventId = response.data.id;

        if (coupon.enabled) {
          try {
            await createCouponMutation.mutateAsync(buildCoupon(eventId));
            await queryClient.invalidateQueries({ queryKey: orpc.coupons.key() });
            addToast({ message: `Coupon ${coupon.code.toUpperCase()} created`, type: 'success' });
          } catch (err: any) {
            addToast({ message: `Event created, but the coupon failed: ${err?.message || 'unknown error'}`, type: 'error' });
          }
        }

        await queryClient.invalidateQueries({ queryKey: orpc.events.key() });
        addToast({ message: 'Event created successfully!', type: 'success' });
        router.push(`/events/${eventId}`);
      } catch (err: any) {
        addToast({ message: err?.message || 'Failed to create event', type: 'error' });
      }
    },
    [createEventMutation, createCouponMutation, coupon, queryClient, addToast, router],
  );

  const isSubmitButtonDisabled = createEventMutation.isPending || createCouponMutation.isPending || !isValid;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Create New Event</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow-lg p-8 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
          <input
            id="title"
            type="text"
            required
            minLength={3}
            maxLength={200}
            {...register('title')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter event title"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea
            id="description"
            required
            minLength={10}
            maxLength={5000}
            rows={5}
            {...register('description')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Describe your event"
          />
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
          <input
            id="location"
            type="text"
            required
            minLength={3}
            maxLength={500}
            {...register('location')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Event location"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
            <input
              id="startDate"
              type="datetime-local"
              required
              {...register('startDate')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
            <input
              id="endDate"
              type="datetime-local"
              required
              {...register('endDate')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">Capacity *</label>
            <input
              id="capacity"
              type="number"
              required
              min={1}
              step={1}
              max={100000}
              {...register('capacity', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="ticketPrice" className="block text-sm font-medium text-gray-700 mb-1">Ticket Price *</label>
            <input
              id="ticketPrice"
              type="number"
              required
              min={0}
              step={0.1}
              {...register('ticketPrice', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">Image URL (Optional)</label>
          <input
            id="imageUrl"
            type="url"
            {...register('imageUrl')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="border-t pt-6">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={coupon.enabled} onChange={(e) => patchCoupon({ enabled: e.target.checked })} />
            Add a promotion coupon for this event
          </label>

          {coupon.enabled && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="couponCode" className="block text-sm font-medium text-gray-700 mb-1">Coupon code *</label>
                <input id="couponCode" type="text" value={coupon.code} onChange={(e) => patchCoupon({ code: e.target.value })} className={`${INPUT} uppercase`} placeholder="EARLY20" />
              </div>
              <div>
                <label htmlFor="couponType" className="block text-sm font-medium text-gray-700 mb-1">Discount type *</label>
                <select id="couponType" value={coupon.discountType} onChange={(e) => patchCoupon({ discountType: e.target.value as CouponForm['discountType'] })} className={INPUT}>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </div>
              <div>
                <label htmlFor="couponValue" className="block text-sm font-medium text-gray-700 mb-1">
                  Discount value * {coupon.discountType === 'PERCENTAGE' ? '(1-100 %)' : '(amount off)'}
                </label>
                <input id="couponValue" type="number" min={1} value={coupon.discountValue} onChange={(e) => patchCoupon({ discountValue: Number(e.target.value) })} className={INPUT} />
              </div>
              <div>
                <label htmlFor="couponMax" className="block text-sm font-medium text-gray-700 mb-1">Max uses *</label>
                <input id="couponMax" type="number" min={1} value={coupon.maxUsages} onChange={(e) => patchCoupon({ maxUsages: Number(e.target.value) })} className={INPUT} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="couponExpires" className="block text-sm font-medium text-gray-700 mb-1">Expires *</label>
                <input id="couponExpires" type="datetime-local" value={coupon.expiresAt} onChange={(e) => patchCoupon({ expiresAt: e.target.value })} className={INPUT} />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitButtonDisabled}
            className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md hover:bg-gray-300 transition-colors font-semibold"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
