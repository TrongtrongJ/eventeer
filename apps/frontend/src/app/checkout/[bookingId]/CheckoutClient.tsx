'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import type { BookingDto } from '@packages/shared-schemas';
import { orpc } from '@/lib/orpc/query';
import { stripePublishableKey } from '@/lib/orpc/config';
import { useToast } from '@/lib/toast/toast-context';
import FullScreenLoader from '@/components/Loader/FullScreenLoader';

const stripePromise = loadStripe(stripePublishableKey);

function CheckoutForm({ currentBooking }: { currentBooking: BookingDto }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const confirmBookingMutation = useMutation(orpc.bookings.confirmBooking.mutationOptions());

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements || !currentBooking) return;

      setIsProcessing(true);

      try {
        const { error: submitError } = await elements.submit();
        if (submitError) throw new Error(submitError.message);

        const { error: paymentError } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/booking/${currentBooking.id}`,
          },
          redirect: 'if_required',
        });

        if (paymentError) throw new Error(paymentError.message);

        await confirmBookingMutation.mutateAsync({ id: currentBooking.id! });

        await queryClient.invalidateQueries({ queryKey: orpc.bookings.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.events.key() });

        addToast({ message: 'Payment successful!', type: 'success' });
        router.push(`/booking/${currentBooking.id}`);
      } catch (error: any) {
        addToast({ message: error?.message || 'Payment failed', type: 'error' });
        setIsProcessing(false);
      }
    },
    [stripe, elements, currentBooking, confirmBookingMutation, addToast, router],
  );

  const finalAmount = currentBooking?.finalAmount.toFixed(2);
  const isSubmitButtonDisabled = !stripe || isProcessing;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Payment Details</h3>
        <PaymentElement />
      </div>

      <button
        type="submit"
        disabled={isSubmitButtonDisabled}
        className="w-full bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-semibold"
      >
        {isProcessing ? 'Processing...' : `Pay $${finalAmount}`}
      </button>
    </form>
  );
}

export function CheckoutClient({ bookingId }: { bookingId: string }) {
  const { data, isLoading } = useQuery(orpc.bookings.findOne.queryOptions({ input: { id: bookingId } }));
  const currentBooking = data?.data;

  if (isLoading) return <FullScreenLoader message="Loading booking details" />;
  if (!currentBooking) return null;

  const options = {
    clientSecret: currentBooking.clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#4F46E5',
      },
    },
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Checkout</h2>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Order Summary</h3>

        <div className="space-y-3 text-gray-600">
          <div className="flex justify-between">
            <span>Quantity:</span>
            <span className="font-semibold">{currentBooking.quantity} ticket(s)</span>
          </div>

          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>${currentBooking.totalAmount.toFixed(2)}</span>
          </div>

          {currentBooking.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({currentBooking.couponCode}):</span>
              <span>-${currentBooking.discount.toFixed(2)}</span>
            </div>
          )}

          <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
            <span>Total:</span>
            <span className="text-indigo-600">${currentBooking.finalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <Elements stripe={stripePromise} options={options}>
        <CheckoutForm currentBooking={currentBooking} />
      </Elements>
    </div>
  );
}
