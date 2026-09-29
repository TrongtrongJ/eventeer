'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type CreateEventDto, CreateEventSchema } from '@packages/shared-schemas';
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

  const onSubmit = useCallback(
    async (data: CreateEventDto) => {
      try {
        const response = await createEventMutation.mutateAsync(data);
        // TanStack Query has no built-in tag invalidation like RTK Query did -
        // invalidate the cached lists explicitly so they don't show stale data.
        await queryClient.invalidateQueries({ queryKey: orpc.events.key() });
        addToast({ message: 'Event created successfully!', type: 'success' });
        router.push(`/events/${response.data.id}`);
      } catch (err: any) {
        addToast({ message: err?.message || 'Failed to create event', type: 'error' });
      }
    },
    [createEventMutation, addToast, router],
  );

  const isSubmitButtonDisabled = createEventMutation.isPending || !isValid;

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
