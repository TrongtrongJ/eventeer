"use client";

import { useCallback } from "react";
import { Copy } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CouponDto } from "@packages/shared-schemas";
import { orpc } from "@/lib/orpc/query";
import { useToast } from "@/lib/toast/toast-context";
import { useFormatter, useTranslations } from "next-intl";
import { useMoney } from "@/i18n/hooks";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import {
    formatExpirationDate,
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
    const hasMinPurchaseAmount = minPurchaseAmount && minPurchaseAmount > 0;

    const couponCodeCopyHandler = useCallback(() => {
        void navigator.clipboard.writeText(code);
        addToast({ message: t("copied"), type: "success" });
    }, [code, addToast, t]);

    return (
        <TableRow className={cn(!isActive && "text-muted-foreground")}>
            <TableCell>
                <div className="flex items-center gap-2">
                    <code className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[13px] font-medium tracking-wide text-foreground">
                        {code}
                    </code>
                    <Button variant="ghost" size="icon-sm" onClick={couponCodeCopyHandler} aria-label={`${t("copy")} ${code}`}>
                        <Copy />
                    </Button>
                    {!isActive && <Badge variant="outline">{t("inactive")}</Badge>}
                </div>
            </TableCell>
            <TableCell>
                <span className={cn("font-medium", isActive && "text-success")}>{couponDiscountText}</span>
                {hasMinPurchaseAmount ? (
                    <span className="block text-xs text-muted-foreground">
                        {t("minPurchase")} {formatMoney(minPurchaseAmount, currency)}
                    </span>
                ) : null}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
                <div className="flex items-center gap-2.5">
                    <Progress
                        value={couponUsageBarWidth}
                        aria-label={t("uses")}
                        className="w-24"
                        indicatorClassName={getCouponsUsagePercentageClass(currentUsages, maxUsages)}
                    />
                    <span className="text-xs tabular-nums">
                        {currentUsages} / {maxUsages}
                    </span>
                </div>
            </TableCell>
            <TableCell className={cn("hidden md:table-cell", getCouponExpirationDateClass(expiresAt))}>
                {formatExpirationDate(format, expiresAt)}
            </TableCell>
            <TableCell>
                <Switch
                    checked={isActive}
                    onCheckedChange={() => void toggleCouponStatus()}
                    disabled={updateCouponMutation.isPending}
                    aria-label={isActive ? t("deactivate") : t("activate")}
                />
            </TableCell>
        </TableRow>
    );
}
