import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { confirmBooking } from '../../store/slices/bookingsSlice';
import { RootState, AppDispatch } from '../../store';
import { addToast } from '../../store/slices/ui';
import { stripePublishableKey } from '@constants/config'

const stripePromise = loadStripe(stripePublishableKey);

const CheckoutForm: React.FC = () => {
  const stripe = useStripe();
  const elements = useElements();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [ isProcessing, setIsProcessing ] = useState(false);
  const { currentBooking } = useSelector((state: RootState) => state.bookings);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !currentBooking) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking/${currentBooking.id}`,
        },
        redirect: 'if_required',
      });

      if (error) {
        throw new Error(error.message);
      }

      // Confirm booking on backend
      await dispatch(confirmBooking(currentBooking.id)).unwrap();

      dispatch(addToast({ message: 'Payment successful!', type: 'success' }));
      navigate(`/booking/${currentBooking.id}`);
    } catch (error: any) {
      dispatch(addToast({ message: error.message || 'Payment failed', type: 'error' }));
      setIsProcessing(false);
    }

    // The following initiated instants are stable and would not change.
    // However, official docs like React-Redux specificly recommends to include them for linting & future-proof.
  }, [stripe, elements, currentBooking, dispatch, navigate]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Payment Details</h3>
        <PaymentElement />
      </div>

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-semibold"
      >
        {isProcessing ? 'Processing...' : `Pay $${currentBooking?.finalAmount.toFixed(2)}`}
      </button>
    </form>
  );
};

const Checkout: React.FC = () => {
  const { currentBooking } = useSelector((state: RootState) => state.bookings);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentBooking || !currentBooking.clientSecret) {
      navigate('/');
    }
  }, [currentBooking, navigate]);

  if (!currentBooking || !currentBooking.clientSecret) {
    return null;
  }

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
    <div className="max-w-2xl mx-auto">
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
        <CheckoutForm />
      </Elements>
    </div>
  );
};

export { Checkout };
