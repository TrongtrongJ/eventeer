"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CouponDto } from "@packages/shared-schemas";
import { orpc } from "@/lib/orpc/query";
import { useToast } from "@/lib/toast/toast-context";
import { useFormatter, useTranslations } from "next-intl";
import { useMoney } from "@/i18n/hooks";
import {
    formatExpirationDate,
    getCouponActiveStatusClass,
    getCouponExpirationDateClass,
    getCouponsUsagePercentage,
    getCouponsUsagePercentageClass,
} from "./helpers";

interface EventCouponItemProps {
    coupon: CouponDto;
    /** Currency of the event the coupon belongs to; FIXED discounts and minimums are amounts in it. */
    currency?: string;
}

export function EventCouponItem({ coupon, currency }: EventCouponItemProps) {
    const { id, code, isActive, discountType, discountValue, currentUsages, maxUsages, expiresAt, minPurchaseAmount } =
        coupon;

    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const t = useTranslations("Coupons");
    const format = useFormatter();
    const formatMoney = useMoney();

    const updateCouponMutation = useMutation(orpc.coupons.updateCoupon.mutationOptions());

    const toggleCouponStatus = useCallback(async () => {
        await updateCouponMutation.mutateAsync({ params: { id }, body: { isActive: !isActive } });
        await queryClient.invalidateQueries({ queryKey: orpc.coupons.getEventCoupons.key() });
    }, [updateCouponMutation, id, isActive, queryClient]);

    const couponDiscountText = t("discountOff", {
        type: discountType,
        value: discountValue,
        amount: formatMoney(discountValue, currency),
    });
    const couponUsageBarWidth = Math.min(getCouponsUsagePercentage(currentUsages, maxUsages), 100);
    const couponExpirationDateText = formatExpirationDate(format, expiresAt);
    const couponExpirationDateClass = getCouponExpirationDateClass(expiresAt);
    const hasMinPurchaseAmount = minPurchaseAmount && minPurchaseAmount > 0;
    const couponStatusClass = getCouponActiveStatusClass(isActive);

    const couponCodeCopyHandler = useCallback(() => {
        void navigator.clipboard.writeText(code);
        addToast({ message: t("copied"), type: "success" });
    }, [code, addToast, t]);

    return (
        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-2xl font-bold font-mono text-indigo-600">{code}</h3>
                            {!isActive && (
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                    {t("inactive")}
                                </span>
                            )}
                        </div>
                        <p className="text-lg font-semibold text-green-600">{couponDiscountText}</p>
                    </div>
                </div>

                <div className="space-y-3 text-sm text-gray-600 mb-4">
                    <div className="flex justify-between">
                        <span>{t("uses")}</span>
                        <span className="font-semibold">
                            {currentUsages} / {maxUsages}
                        </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full ${getCouponsUsagePercentageClass(currentUsages, maxUsages)}`}
                            style={{ width: `${couponUsageBarWidth}%` }}
                        />
                    </div>

                    <div className="flex justify-between">
                        <span>{t("expires")}</span>
                        <span className={`font-semibold ${couponExpirationDateClass}`}>{couponExpirationDateText}</span>
                    </div>

                    {hasMinPurchaseAmount && (
                        <div className="flex justify-between">
                            <span>{t("minPurchase")}</span>
                            <span className="font-semibold">{formatMoney(minPurchaseAmount, currency)}</span>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={toggleCouponStatus}
                        disabled={updateCouponMutation.isPending}
                        className={`flex-1 px-4 py-2 rounded-md font-semibold ${couponStatusClass}`}
                    >
                        {isActive ? t("deactivate") : t("activate")}
                    </button>

                    <button
                        onClick={couponCodeCopyHandler}
                        className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200 font-semibold"
                    >
                        {t("copy")}
                    </button>
                </div>
            </div>
        </div>
    );
}
