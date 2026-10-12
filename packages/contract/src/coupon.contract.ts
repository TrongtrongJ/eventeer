import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { CreateCouponSchema, CouponSchema, UpdateCouponSchema } from "@packages/shared-schemas";
import { createBaseResponse } from "./base/base-response.dto";

export const couponContract = oc.router({
    createCoupon: oc
        .input(CreateCouponSchema)
        .output(createBaseResponse(CouponSchema))
        .meta(
            openapi({
                method: "POST",
                path: "/coupons",
                description: "Create new coupon for an event",
                tags: ["Coupon"]
            }),
        ),
    getEventCoupons: oc
        .input(
            z.object({
                eventId: z.uuid(),
            }),
        )
        .output(createBaseResponse(z.array(CouponSchema)))
        .meta(
            openapi({
                method: "GET",
                path: "/coupons/event/{eventId}",
                description: "Get all coupons of an event",
                tags: ["Coupon"]
            }),
        ),
    getCoupon: oc
        .input(
            z.object({
                params: z.object({
                    code: z.string(),
                }),
                query: z.object({
                    eventId: z.uuid(),
                }),
            }),
        )
        .output(createBaseResponse(CouponSchema))
        .meta(
            openapi({
                method: "GET",
                path: "/coupons/{code}",
                description: "Get coupon by coupon code",
                inputStructure: "detailed",
                tags: ["Coupon"]
            }),
        ),
    updateCoupon: oc
        .input(
            z.object({
                params: z.object({
                    id: z.uuid(),
                }),
                body: UpdateCouponSchema,
            }),
        )
        .output(createBaseResponse(CouponSchema))
        .meta(
            openapi({
                method: "PATCH",
                path: "/coupons/{id}",
                description: "Update coupon by id",
                inputStructure: "detailed",
                tags: ["Coupon"]
            }),
        ),
});
