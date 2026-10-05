'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import type { BookingDto } from '@packages/shared-schemas';
import { orpc } from '@/lib/orpc/query';
import { stripePublishableKey } from '@/lib/orpc/config';
import { formatMoney } from '@/lib/format';
import { useToast } from '@/lib/toast/toast-context';
import FullScreenLoader from '@/components/Loader/FullScreenLoader';

// No publishable key = demo mode (the API is in mock-payments mode too): no Stripe.js at all.
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const PAY_BUTTON =
  'w-full bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-semibold';

/** Shared "payment finished, now let the API verify and issue tickets" step. */
function useFinalizeBooking(bookingId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const confirmBooking = useMutation(orpc.bookings.confirmBooking.mutationOptions());

  return useCallback(async () => {
    await confirmBooking.mutateAsync({ id: bookingId });
    await queryClient.invalidateQueries({ queryKey: orpc.bookings.key() });
    await queryClient.invalidateQueries({ queryKey: orpc.events.key() });
    addToast({ message: 'Payment successful!', type: 'success' });
    router.push(`/booking/${bookingId}`);
  }, [confirmBooking, queryClient, addToast, router, bookingId]);
}

function StripeCheckoutForm({ booking }: { booking: BookingDto }) {
  const stripe = useStripe();
  const elements = useElements();
  const { addToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const finalize = useFinalizeBooking(booking.id);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;
      setIsProcessing(true);

      try {
        const { error: submitError } = await elements.submit();
        if (submitError) throw new Error(submitError.message);

        const { error: paymentError } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: `${window.location.origin}/booking/${booking.id}` },
          redirect: 'if_required',
        });
        if (paymentError) throw new Error(paymentError.message);

        await finalize();
      } catch (error: any) {
        addToast({ message: error?.message || 'Payment failed', type: 'error' });
        setIsProcessing(false);
      }
    },
    [stripe, elements, booking.id, finalize, addToast],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Payment Details</h3>
        <PaymentElement />
      </div>
      <button type="submit" disabled={!stripe || isProcessing} className={PAY_BUTTON}>
        {isProcessing ? 'Processing...' : `Pay ${formatMoney(booking.finalAmount, booking.currency)}`}
      </button>
    </form>
  );
}

/** Demo mode: lets the whole booking flow be exercised without a payment provider. */
function DemoCheckoutForm({ booking }: { booking: BookingDto }) {
  const { addToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const finalize = useFinalizeBooking(booking.id);

  const handlePay = useCallback(async () => {
    setIsProcessing(true);
    try {
      await finalize();
    } catch (error: any) {
      addToast({ message: error?.message || 'Payment failed', type: 'error' });
      setIsProcessing(false);
    }
  }, [finalize, addToast]);

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm">
        <strong>Demo mode.</strong> No payment provider is configured, so no card is charged. Set
        <code className="mx-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and the API&apos;s Stripe keys for real payments.
      </div>
      <button type="button" onClick={handlePay} disabled={isProcessing} className={PAY_BUTTON}>
        {isProcessing ? 'Processing...' : `Pay ${formatMoney(booking.finalAmount, booking.currency)} (demo)`}
      </button>
    </div>
  );
}

function SeatHoldNotice({ expiresAt }: { expiresAt?: string | null }) {
  if (!expiresAt) return null;
  return (
    <p className="text-sm text-gray-500 mb-4">
      Your seats are held until{' '}
      <span className="font-medium">{new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      . Complete payment before then or they are released.
    </p>
  );
}

export function CheckoutClient({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { data, isLoading } = useQuery(orpc.bookings.findOne.queryOptions({ input: { id: bookingId } }));
  const booking = data?.data;

  if (isLoading) return <FullScreenLoader message="Loading booking details" />;
  if (!booking) return null;

  // Already paid (e.g. back button after paying): go straight to the tickets.
  if (booking.status === 'CONFIRMED') {
    router.replace(`/booking/${booking.id}`);
    return null;
  }

  // Hold lapsed / cancelled: the seats are gone, so there is nothing left to pay for.
  if (booking.status !== 'PENDING') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">This reservation is no longer active</h2>
        <p className="text-gray-600 mb-6">
          It was {booking.status.toLowerCase()}, and the seats have been released. You haven&apos;t been charged.
        </p>
        <Link href={`/events/${booking.eventId}`} className="text-indigo-600 font-medium hover:text-indigo-500">
          Back to the event
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h2>
      <SeatHoldNotice expiresAt={booking.expiresAt} />

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Order Summary</h3>
        <div className="space-y-3 text-gray-600">
          <div className="flex justify-between">
            <span>Quantity:</span>
            <span className="font-semibold">{booking.quantity} ticket(s)</span>
          </div>
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatMoney(booking.totalAmount, booking.currency)}</span>
          </div>
          {booking.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({booking.couponCode}):</span>
              <span>-{formatMoney(booking.discount, booking.currency)}</span>
            </div>
          )}
          <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
            <span>Total:</span>
            <span className="text-indigo-600">{formatMoney(booking.finalAmount, booking.currency)}</span>
          </div>
        </div>
      </div>

      {stripePromise && booking.clientSecret ? (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: booking.clientSecret,
            appearance: { theme: 'stripe', variables: { colorPrimary: '#4F46E5' } },
          }}
        >
          <StripeCheckoutForm booking={booking} />
        </Elements>
      ) : (
        <DemoCheckoutForm booking={booking} />
      )}
    </div>
  );
}
