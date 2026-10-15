"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type CreateCouponDto, CreateCouponSchema } from "@packages/shared-schemas";
import { orpc } from "@/lib/orpc/query";
import { useToast } from "@/lib/toast/toast-context";
import { useTranslations } from "next-intl";
import { useMoney } from "@/i18n/hooks";
import { CouponFormSkeleton } from "@/components/Loader/PageSkeletons";
import EmptyList from "@/components/EmptyList";
import { generateRandomCouponCode } from "./helpers";
import { PageContent, PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";

export function CreateCouponClient({ eventId }: { eventId: string }) {
    const router = useRouter();
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const t = useTranslations("CreateCoupon");
    const tc = useTranslations("Common");
    const tNav = useTranslations("Nav");
    const tCoupons = useTranslations("Coupons");
    const formatMoney = useMoney();

    const { data: eventData, isLoading: isLoadingEvent } = useQuery(
        orpc.events.findOne.queryOptions({ input: { id: eventId } }),
    );
    const event = eventData?.data;

    const createCouponMutation = useMutation(orpc.coupons.createCoupon.mutationOptions());

    const {
        register,
        watch,
        setValue,
        handleSubmit,
        formState: { errors },
    } = useForm<CreateCouponDto>({
        resolver: zodResolver(CreateCouponSchema),
        defaultValues: {
            code: "",
            eventId,
            discountType: "PERCENTAGE",
            discountValue: 10,
            maxUsages: 100,
            expiresAt: "",
            minPurchaseAmount: 0,
            eventTicketPrice: 0,
        },
    });

    // The form mounts before the event query resolves, so defaultValues can't
    // know the ticket price yet - sync it in once the event loads.
    useEffect(() => {
        if (event) setValue("eventTicketPrice", event.ticketPrice);
    }, [event, setValue]);

    const setRandomCouponCode = useCallback(() => {
        setValue("code", generateRandomCouponCode());
    }, [setValue]);

    const onSubmit = useCallback(
        async (data: CreateCouponDto) => {
            try {
                await createCouponMutation.mutateAsync(data);
                await queryClient.invalidateQueries({ queryKey: orpc.coupons.key() });
                addToast({ message: t("created"), type: "success" });
                router.push(`/events/${eventId}/coupons`);
            } catch (err: any) {
                addToast({ message: err?.message || t("failed"), type: "error" });
            }
        },
        [createCouponMutation, addToast, router, eventId, queryClient, t],
    );

    if (isLoadingEvent) {
        return (
            <>
                <PageHeader crumbs={[{ label: tNav("myEvents"), href: "/my-events" }]} title={t("heading")} titleAsText />
                <CouponFormSkeleton />
            </>
        );
    }

    if (!event) {
        return <EmptyList message={t("notFound")} />;
    }

    const discountType = watch("discountType");
    const discountValue = watch("discountValue");
    const currency = event.currency;
    const discountUnit = discountType === "PERCENTAGE" ? "%" : currency;
    const formattedDiscountText = tCoupons("discountOff", {
        type: discountType,
        value: discountValue,
        amount: formatMoney(discountValue, currency),
    });
    const couponCode = watch("code");
    const maxUsages = watch("maxUsages");
    const minPurchaseAmount = watch("minPurchaseAmount");
    const hasMinPurchaseAmount = minPurchaseAmount != null && minPurchaseAmount > 0;

    return (
        <>
            <PageHeader
                crumbs={[
                    { label: tNav("myEvents"), href: "/my-events" },
                    { label: event.title, href: `/events/${eventId}` },
                    { label: tCoupons("title"), href: `/events/${eventId}/coupons` },
                ]}
                title={t("heading")}
                titleAsText
            />

            <PageContent width="wide">
                <div className="mb-6 space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
                    <p className="text-sm text-muted-foreground">{t("forEvent", { title: event.title })}</p>
                </div>

                <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <Field>
                            <FieldLabel htmlFor="code">{t("code")}</FieldLabel>
                            <div className="flex gap-2">
                                <Input
                                    id="code"
                                    type="text"
                                    required
                                    maxLength={50}
                                    className="flex-1 font-mono uppercase placeholder:normal-case"
                                    placeholder={t("codePlaceholder")}
                                    {...register("code")}
                                />
                                <Button type="button" variant="outline" onClick={setRandomCouponCode}>
                                    {t("generate")}
                                </Button>
                            </div>
                            <FieldDescription>{t("codeHelp")}</FieldDescription>
                        </Field>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="discountType">{t("discountType")}</FieldLabel>
                                <NativeSelect id="discountType" required {...register("discountType")}>
                                    <option value="PERCENTAGE">{t("percentage")}</option>
                                    <option value="FIXED">{t("fixed", { currency })}</option>
                                </NativeSelect>
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="discountValue">{t("discountValue")}</FieldLabel>
                                <div className="relative">
                                    <Input
                                        id="discountValue"
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        className="pr-12 tabular-nums"
                                        {...register("discountValue", { valueAsNumber: true })}
                                    />
                                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                                        {discountUnit}
                                    </span>
                                </div>
                            </Field>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="maxUsages">{t("maxUses")}</FieldLabel>
                                <Input
                                    id="maxUsages"
                                    type="number"
                                    required
                                    min="1"
                                    max="10000"
                                    className="tabular-nums"
                                    {...register("maxUsages", { valueAsNumber: true })}
                                />
                                <FieldDescription>{t("maxUsesHelp")}</FieldDescription>
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="expiresAt">{t("expiration")}</FieldLabel>
                                <Input
                                    id="expiresAt"
                                    type="datetime-local"
                                    required
                                    {...register("expiresAt", {
                                        setValueAs: v => (v ? new Date(v).toISOString() : v),
                                    })}
                                />
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel htmlFor="minPurchaseAmount">{t("minPurchase")}</FieldLabel>
                            <div className="relative">
                                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground">
                                    {currency}
                                </span>
                                <Input
                                    id="minPurchaseAmount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="pl-12 tabular-nums"
                                    placeholder="0.00"
                                    {...register("minPurchaseAmount", { valueAsNumber: true })}
                                />
                            </div>
                            <FieldDescription>{t("minPurchaseHelp")}</FieldDescription>
                        </Field>

                        <div className="flex items-center justify-end gap-2 border-t pt-5">
                            <Button type="button" variant="ghost" onClick={() => router.push(`/events/${eventId}/coupons`)}>
                                {tc("cancel")}
                            </Button>
                            <Button type="submit" disabled={createCouponMutation.isPending}>
                                {createCouponMutation.isPending && <Spinner />}
                                {createCouponMutation.isPending ? t("creating") : t("submit")}
                            </Button>
                        </div>
                    </form>

                    <aside className="xl:sticky xl:top-17 xl:self-start">
                        <Card className="gap-0 py-0">
                            <CardHeader className="border-b py-3">
                                <CardTitle className="text-xs font-medium text-muted-foreground">{t("preview")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 py-4 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">{t("previewCode")}</span>
                                    <code className="rounded border bg-muted px-1.5 py-0.5 font-mono font-medium tracking-wide">
                                        {couponCode || "XXXXX"}
                                    </code>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">{t("previewDiscount")}</span>
                                    <span className="font-medium text-success">{formattedDiscountText}</span>
                                </div>
                                <p className="text-muted-foreground">{t("previewUses", { count: maxUsages })}</p>
                                {hasMinPurchaseAmount && (
                                    <p className="text-muted-foreground">
                                        {t("previewMin", { amount: formatMoney(minPurchaseAmount, currency) })}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </PageContent>
        </>
    );
}
