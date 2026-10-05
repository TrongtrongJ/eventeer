import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';
import { EventSchema, CreateEventSchema, EventQuerySchema, UpdateEventSchema } from '@packages/shared-schemas';
import { createBaseResponse } from './base/base-response.dto';
import { createPaginatedResponse } from './base/base-pagination.dto';

export const eventContract = oc.router({
  create: oc
    .input(CreateEventSchema)
    .output(createBaseResponse(EventSchema))
    .meta(openapi({ 
      method: 'POST', 
      path: '/',
      description: 'Create new event' 
    })),
  findAll: oc
    .input(EventQuerySchema)
    .output(createPaginatedResponse(EventSchema))
    .meta(openapi({ 
      method: 'GET', 
      path: '/',
      description: 'List events with filters and pagination' 
    })),
  findOne: oc
    .input(z.object({
      id: z.uuid()
    }))
    .output(createBaseResponse(EventSchema))
    .meta(openapi({ 
      method: 'GET', 
      path: '/{id}',
      description: 'Get event item by id' 
    })),
  getMyEvents: oc
    .output(createBaseResponse(z.array(EventSchema)))
    .meta(openapi({ 
      method: 'GET', 
      path: '/my/events',
      description: 'Get current user events' 
    })),
  updateEvent: oc
    .input(z.object({
      params: z.object({ id: z.uuid() }),
      body: UpdateEventSchema
    }))
    .output(createBaseResponse(EventSchema))
    .meta(openapi({ 
      method: 'PUT', 
      path: '/{id}',
      description: 'Update event by id',
      inputStructure: 'detailed',
    })),
  deleteEvent: oc
    .input(z.object({
      id: z.uuid()
    }))
    .output(createBaseResponse(z.null()))
    .meta(openapi({ 
      method: 'DELETE', 
      path: '/{id}',
      description: 'Delete event by id',
    })),
})