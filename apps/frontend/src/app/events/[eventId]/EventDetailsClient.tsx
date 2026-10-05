'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type CreateBookingDto, CreateBookingSchema, type UserDto, type EventDto } from '@packages/shared-schemas';
import { orpc } from '@/lib/orpc/query';
import { formatEventDate } from './helpers';
import { formatMoney } from '@/lib/format';
import { useToast } from '@/lib/toast/toast-context';
import { useSeatUpdates } from '@/hooks/useSeatUpdates';

interface EventDetailsClientProps {
  event: EventDto;
  isAuthenticated: boolean;
  user: UserDto | null;
}

export function EventDetailsClient({ event, isAuthenticated, user }: EventDetailsClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { addToast } = useToast();
  const availableSeats = useSeatUpdates(event.id, event.availableSeats);

  const createBookingMutation = useMutation(orpc.bookings.createBooking.mutationOptions());

  const {
    register,
    watch,
    handleSubmit,
    formState: { isValid, errors },
  } = useForm<CreateBookingDto>({
    resolver: zodResolver(CreateBookingSchema),
    defaultValues: {
      eventId: event.id,
      quantity: 1,
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      couponCode: '',
    },
  });

  const onSubmit = useCallback(
    async (data: CreateBookingDto) => {
      try {
        const response = await createBookingMutation.mutateAsync(data);
        // Booking a seat changes the event's availableSeats - invalidate so
        // a back-navigation to the event/list doesn't show a stale count.
        await queryClient.invalidateQueries({ queryKey: orpc.events.key() });
        router.replace(`/checkout/${response.data.id}`);
      } catch (err: any) {
        // e.g. invalid / expired / sold-out coupon, sold-out event: the API's message is user-facing.
        addToast({ message: err?.message || 'Failed to create booking', type: 'error' });
      }
    },
    [createBookingMutation, queryClient, router, addToast],
  );

  const quantity = watch('quantity');
  const maxTicketQuantity = Math.min(20, availableSeats);
  const totalPrice = event.ticketPrice * quantity;
  const formattedTotalPrice = formatMoney(totalPrice, event.currency);
  const selectedEventData = formatEventDate(event.startDate);
  const canPurchase = availableSeats > 0 && isAuthenticated;
  const isSubmitButtonDisabled = createBookingMutation.isPending || !isValid;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/" className="mb-6 text-indigo-600 hover:text-indigo-800 flex items-center">
        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Events
      </Link>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {event.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt={event.title} className="w-full h-64 object-cover" />
        )}

        <div className="p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{event.title}</h1>

          {event.organizerName && (
            <p className="text-sm text-gray-500 mb-4">
              Organized by <span className="font-medium">{event.organizerName}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6 text-gray-600">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {selectedEventData}
            </div>

            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {event.location}
            </div>
          </div>

          <p className="text-gray-700 mb-6">{event.description}</p>

          <div className="bg-indigo-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-700">Available Seats:</span>
              <span className={`text-2xl font-bold ${availableSeats > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {availableSeats} / {event.capacity}
              </span>
            </div>
          </div>

          {!isAuthenticated && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="text-yellow-800">
                  Please{' '}
                  <Link href="/login" className="font-medium underline">
                    login
                  </Link>{' '}
                  to book tickets
                </span>
              </div>
            </div>
          )}

          {canPurchase && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    {...register('firstName')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    {...register('lastName')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  {...register('email')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  max={maxTicketQuantity}
                  required
                  {...register('quantity', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="couponCode" className="block text-sm font-medium text-gray-700 mb-1">Coupon Code (Optional)</label>
                <input
                  id="couponCode"
                  type="text"
                  {...register('couponCode')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter code"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-700">Total:</span>
                  <span className="text-3xl font-bold text-indigo-600">{formattedTotalPrice}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitButtonDisabled}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-semibold"
              >
                {createBookingMutation.isPending ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
