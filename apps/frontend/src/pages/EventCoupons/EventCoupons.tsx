import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetEventCouponsQuery } from '../../store/slices/coupons/couponsApi';
import SpinnerLoader from '../../components/Loader/SpinnerLoader';
import { useGetEventByIdQuery } from '../../store/slices/events/eventsApi';
import EventsCouponsPanel from './EventCouponsPanel';
import EmptyList from '../../components/EmptyList';


const EventCoupons: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const { 
    data: event, 
    isLoading: isEventLoading, 
    isError: isEventError,
  } = useGetEventByIdQuery(eventId!, 
    {skip: !eventId}
  );

  const { 
    data: coupons, 
    isLoading, 
    isError, 
    error 
  } = useGetEventCouponsQuery(eventId!, 
    {skip: !eventId}
  );

  if (isEventLoading) {
    return (
      <SpinnerLoader />
    );
  }

  if (isEventError || !event) {
    return <EmptyList message="Failed to find an event with specified eventId!" />
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
      {coupons && <EventsCouponsPanel eventId={eventId!} coupons={coupons} />}
    </div>
  );
};

export { EventCoupons };