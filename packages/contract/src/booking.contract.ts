import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';
import { BookingSchema, CreateBookingSchema } from '@packages/shared-schemas';
import { createBaseResponse } from './base/base-response.dto';

export const bookingContract = oc.router({
  createBooking: oc
    .input(CreateBookingSchema)
    .output(createBaseResponse(BookingSchema))
    .meta(openapi({ 
      method: 'POST', 
      path: '/create',
      description: 'Create booking' 
    })),
  confirmBooking: oc
    .input(z.object({
      id: z.uuid()  
    }))
    .output(createBaseResponse(BookingSchema))
    .meta(openapi({ 
      method: 'POST', 
      path: '/{id}/confirm',
      description: 'Create booking'
    })),
  findOne: oc
    .input(z.object({
      id: z.uuid()
    }))
    .output(createBaseResponse(BookingSchema))
    .meta(openapi({ 
      method: 'GET', 
      path: '/{id}',
      description: 'Find booking by id'
    })),
  getMyBookings: oc
    .output(createBaseResponse(z.array(BookingSchema)))
    .meta(openapi({ 
      method: 'GET', 
      path: '/booking/me',
      description: 'Get user bookings'
    })),
  cancelBooking: oc
    .input(z.object({
      id: z.uuid()  
    }))
    .output(createBaseResponse(z.null()))
    .meta(openapi({ 
      method: 'DELETE', 
      path: '/{id}',
      description: 'Delete booking'
    })),
  adminListBookings: oc
    .output(createBaseResponse(z.array(BookingSchema)))
    .meta(openapi({
      method: 'GET', 
      path: '/admin/all',
      description: 'Admin endpoint to view all bookings',
    })),
  getEventBookings: oc
    .output(createBaseResponse(z.array(BookingSchema)))
    .input(z.object({
      eventId: z.uuid()
    }))
    .meta(openapi({
      method: 'GET', 
      path: '/event/{eventId}/bookings',
      description: 'Organizer endpoint to view bookings for their events',
    })),
})