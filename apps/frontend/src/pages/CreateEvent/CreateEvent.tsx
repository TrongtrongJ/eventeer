import React from 'react';
import { z } from 'zod'
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useCreateEventMutation } from '../../store/slices/events/eventsApi'
import { type CreateEventDto, CreateEventSchema } from '@event-mgmt/shared-schemas';
import { initialFormData } from './constants'

const CreateEvent: React.FC = () => {
  const navigate = useNavigate();

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors, isValid},
  } = useForm<CreateEventDto>({
    resolver: zodResolver(CreateEventSchema),
    defaultValues: {...structuredClone(initialFormData)}
  })

  const [createEvent, { isLoading }] = useCreateEventMutation()

  const onSubmit = async (data: CreateEventDto) => {
    try {
      await createEvent(data).unwrap();
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  };

  const isSubmitButtonDisabled = isLoading || !isValid

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Create New Event</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow-lg p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
          <input
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
          <input
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
            <input
              type="datetime-local"
              required
              {...register('startDate', { valueAsDate: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
            <input
              type="datetime-local"
              required
              {...register('endDate', { valueAsDate: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacity *</label>
            <input
              type="number"
              required
              min={1}
              step={1}
              max={100000}
              {...register('capacity', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Price *</label>
              <input
                type="number"
                required
                min={0}
                step={0.1}
                {...register('ticketPrice', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            {/*<div>
              <input
                required
                {...register('currency')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>*/}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image URL (Optional)
          </label>
          <input
            type="url"
            {...register('imageUrl')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitButtonDisabled}
            className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {isLoading ? 'Creating...' : 'Create Event'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md hover:bg-gray-300 transition-colors font-semibold"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export { CreateEvent };
