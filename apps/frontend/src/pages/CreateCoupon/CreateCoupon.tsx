import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { addToast } from '../../store/slices/ui';
import { apiClient } from '../../api/client';
import { CreateCouponDto } from '@event-mgmt/shared-schemas';

const CreateCoupon: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<any>(null);

  const [formData, setFormData] = useState<CreateCouponDto>({
    code: '',
    eventId: eventId || '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxUsages: 100,
    expiresAt: '',
    minPurchaseAmount: 0,
  });

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const response = await apiClient.get(`/events/${eventId}`);
      setEvent(response.data.data);
      setFormData(prev => ({ ...prev, eventId: eventId! }));
    } catch (error) {
      dispatch(addToast({ message: 'Failed to load event', type: 'error' }));
      navigate('/events/my');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const couponData = {
        ...formData,
        code: formData.code.toUpperCase(),
        expiresAt: new Date(formData.expiresAt).toISOString(),
        minPurchaseAmount: formData.minPurchaseAmount || undefined,
      };

      await apiClient.post('/coupons', couponData);
      
      dispatch(addToast({ 
        message: 'Coupon created successfully!', 
        type: 'success' 
      }));
      
      navigate(`/events/${eventId}/coupons`);
    } catch (error: any) {
      dispatch(addToast({ 
        message: error.response?.data?.message || 'Failed to create coupon', 
        type: 'error' 
      }));
    } finally {
      setLoading(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  if (!event) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const hasMinPurchaseAmount = formData.minPurchaseAmount != null && formData.minPurchaseAmount > 0

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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coupon Code *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                maxLength={50}
                value={formData.code}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  code: e.target.value.toUpperCase() 
                })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 uppercase"
                placeholder="SUMMER2025"
              />
              <button
                type="button"
                onClick={generateRandomCode}
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
                value={formData.discountType}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  discountType: e.target.value as 'PERCENTAGE' | 'FIXED' 
                })}
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
                  max={formData.discountType === 'PERCENTAGE' ? 100 : undefined}
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    discountValue: parseFloat(e.target.value) 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2 text-gray-500">
                  {formData.discountType === 'PERCENTAGE' ? '%' : '$'}
                </span>
              </div>
              {formData.discountType === 'PERCENTAGE' && (
                <p className="text-xs text-gray-500 mt-1">
                  Max 100%
                </p>
              )}
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
                value={formData.maxUsages}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  maxUsages: parseInt(e.target.value) 
                })}
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
                value={formData.expiresAt}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  expiresAt: e.target.value 
                })}
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
                value={formData.minPurchaseAmount || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  minPurchaseAmount: e.target.value ? parseFloat(e.target.value) : 0
                })}
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
                Code: <span className="font-mono font-bold">{formData.code || 'XXXXX'}</span>
              </p>
              <p>
                Discount: <span className="font-semibold text-green-600">
                  {formData.discountType === 'PERCENTAGE' 
                    ? `${formData.discountValue}% off` 
                    : `$${formData.discountValue} off`}
                </span>
              </p>
              <p>Available uses: {formData.maxUsages}</p>
              {hasMinPurchaseAmount && (
                <p>Minimum purchase: ${formData.minPurchaseAmount}</p>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {loading ? 'Creating...' : 'Create Coupon'}
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