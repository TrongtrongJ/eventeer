import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';
import { CreateCouponSchema, CouponSchema, UpdateCouponSchema, BookingSchema } from '@packages/shared-schemas';
import { createBaseResponse } from './base/base-response.dto';

export const couponContract = oc.router({
  createCoupon: oc
    .input(CreateCouponSchema)
    .output(createBaseResponse(CouponSchema))
    .meta(openapi({ 
      method: 'POST', 
      path: '/',
      description: 'Create new coupon for an event' 
    })),
  getEventCoupons: oc
    .input(z.object({
      eventId: z.uuid()
    }))
    .output(createBaseResponse(z.array(CouponSchema)))
    .meta(openapi({
      method: 'GET', 
      path: '/event/{eventId}',
      description: 'Get all coupons of an event' 
    })),
  getCoupon: oc
    .input(z.object({
      params: z.object({
        code: z.string()
      }),
      query: z.object({
        eventId: z.uuid()
      })
    }))
    .output(createBaseResponse(CouponSchema))
    .meta(openapi({
      method: 'GET', 
      path: '/{code}',
      description: 'Get coupon by coupon code',
      inputStructure: 'detailed',
    })),
  updateCoupon: oc
    .input(z.object({
      params: z.object({
        id: z.uuid()
      }),
      body: UpdateCouponSchema
    }))
    .output(createBaseResponse(CouponSchema))
    .meta(openapi({
      method: 'PATCH', 
      path: '/{id}',
      description: 'Update coupon by id',
      inputStructure: 'detailed',
    })),
})