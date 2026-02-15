import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { addToast } from '../store/slices/ui';
import { apiClient } from '../api/client';

const EventCoupons: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [coupons, setCoupons] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      const [eventRes, couponsRes] = await Promise.all([
        apiClient.get(`/events/${eventId}`),
        apiClient.get(`/coupons/event/${eventId}`),
      ]);
      
      setEvent(eventRes.data.data);
      setCoupons(couponsRes.data.data || []);
    } catch (error: any) {
      dispatch(addToast({ 
        message: 'Failed to load coupons', 
        type: 'error' 
      }));
    } finally {
      setLoading(false);
    }
  };

  const toggleCouponStatus = async (couponId: string, currentStatus: boolean) => {
    try {
      await apiClient.patch(`/coupons/${couponId}`, {
        isActive: !currentStatus,
      });
      
      dispatch(addToast({ 
        message: `Coupon ${!currentStatus ? 'activated' : 'deactivated'}`, 
        type: 'success' 
      }));
      
      fetchData();
    } catch (error) {
      dispatch(addToast({ 
        message: 'Failed to update coupon', 
        type: 'error' 
      }));
    }
  };

  const getUsagePercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/events/${eventId}`)}
          className="text-indigo-600 hover:text-indigo-800 flex items-center mb-4"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Event
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Coupons</h1>
            <p className="text-gray-600">For: {event?.title}</p>
          </div>
          
          <button
            onClick={() => navigate(`/events/${eventId}/coupons/create`)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 font-semibold"
          >
            + Create Coupon
          </button>
        </div>
      </div>

      {coupons.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No coupons yet</h3>
          <p className="text-gray-600 mb-6">Create your first coupon to offer discounts to your attendees</p>
          <button
            onClick={() => navigate(`/events/${eventId}/coupons/create`)}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
          >
            Create First Coupon
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-2xl font-bold font-mono text-indigo-600">
                        {coupon.code}
                      </h3>
                      {!coupon.isActive && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-semibold text-green-600">
                      {coupon.discountType === 'PERCENTAGE' 
                        ? `${coupon.discountValue}% off` 
                        : `$${coupon.discountValue} off`}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-gray-600 mb-4">
                  <div className="flex justify-between">
                    <span>Uses:</span>
                    <span className="font-semibold">
                      {coupon.currentUsages} / {coupon.maxUsages}
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        getUsagePercentage(coupon.currentUsages, coupon.maxUsages) >= 100 
                          ? 'bg-red-500' 
                          : getUsagePercentage(coupon.currentUsages, coupon.maxUsages) >= 80
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(getUsagePercentage(coupon.currentUsages, coupon.maxUsages), 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between">
                    <span>Expires:</span>
                    <span className={`font-semibold ${
                      new Date(coupon.expiresAt) < new Date() ? 'text-red-600' : ''
                    }`}>
                      {new Date(coupon.expiresAt).toLocaleDateString()}
                    </span>
                  </div>

                  {coupon.minPurchaseAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Min. purchase:</span>
                      <span className="font-semibold">
                        ${coupon.minPurchaseAmount}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleCouponStatus(coupon.id, coupon.isActive)}
                    className={`flex-1 px-4 py-2 rounded-md font-semibold ${
                      coupon.isActive
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {coupon.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(coupon.code);
                      dispatch(addToast({ message: 'Code copied!', type: 'success' }));
                    }}
                    className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200 font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventCoupons;