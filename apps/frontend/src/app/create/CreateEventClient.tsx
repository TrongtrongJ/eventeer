"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type CreateEventDto, CreateEventSchema, CreateCouponSchema } from "@packages/shared-schemas";
import { orpc } from "@/lib/orpc/query";
import { useToast } from "@/lib/toast/toast-context";
import { useTranslations } from "next-intl";
import { useValidationMessage } from "@/i18n/validation";
import { PageContent, PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { EventImageField } from "@/components/event-image/EventImageField";

const initialFormData: CreateEventDto = {
    title: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    capacity: 100,
    ticketPrice: 0,
    currency: "THB",
};

interface CouponForm {
    enabled: boolean;
    code: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    maxUsages: number;
    expiresAt: string; // datetime-local value
}

const initialCoupon: CouponForm = {
    enabled: false,
    code: "",
    discountType: "PERCENTAGE",
    discountValue: 10,
    maxUsages: 50,
    expiresAt: "",
};

export function CreateEventClient() {
    const router = useRouter();
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const t = useTranslations("CreateEvent");
    const tc = useTranslations("Common");
    const tNav = useTranslations("Nav");
    const localizeMessage = useValidationMessage();

    const {
        register,
        handleSubmit,
        setValue,
        formState: { isValid },
    } = useForm<CreateEventDto>({
        resolver: zodResolver(CreateEventSchema),
        defaultValues: initialFormData,
    });

    const createEventMutation = useMutation(orpc.events.create.mutationOptions());
    const createCouponMutation = useMutation(orpc.coupons.createCoupon.mutationOptions());
    const [coupon, setCoupon] = useState<CouponForm>(initialCoupon);
    const patchCoupon = (patch: Partial<CouponForm>) => setCoupon(c => ({ ...c, ...patch }));

    const onSubmit = useCallback(
        async (data: CreateEventDto) => {
            // Validate the coupon BEFORE creating the event, so a bad coupon can't leave an
            // event behind without its promotion. The event id is only known afterwards, so
            // validate against a placeholder uuid here.
            const buildCoupon = (eventId: string) => ({
                code: coupon.code,
                eventId,
                discountType: coupon.discountType,
                discountValue: Number(coupon.discountValue),
                maxUsages: Number(coupon.maxUsages),
                expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString() : "",
                eventTicketPrice: Number(data.ticketPrice),
            });

            if (coupon.enabled) {
                const check = CreateCouponSchema.safeParse(buildCoupon(crypto.randomUUID()));
                if (!check.success) {
                    addToast({
                        message: t("couponInvalid", {
                            message: localizeMessage(check.error.issues[0]?.message) || t("couponInvalidFallback"),
                        }),
                        type: "error",
                    });
                    return;
                }
            }

            try {
                const response = await createEventMutation.mutateAsync(data);
                const eventId = response.data.id;

                if (coupon.enabled) {
                    try {
                        await createCouponMutation.mutateAsync(buildCoupon(eventId));
                        await queryClient.invalidateQueries({ queryKey: orpc.coupons.key() });
                        addToast({
                            message: t("couponCreated", { code: coupon.code.toUpperCase() }),
                            type: "success",
                        });
                    } catch (err: any) {
                        addToast({
                            message: t("couponFailed", { error: err?.message || t("unknownError") }),
                            type: "error",
                        });
                    }
                }

                await queryClient.invalidateQueries({ queryKey: orpc.events.key() });
                addToast({ message: t("created"), type: "success" });
                router.push(`/events/${eventId}`);
            } catch (err: any) {
                addToast({ message: err?.message || t("failed"), type: "error" });
            }
        },
        [createEventMutation, createCouponMutation, coupon, queryClient, addToast, router, t, localizeMessage],
    );

    const isSubmitButtonDisabled = createEventMutation.isPending || createCouponMutation.isPending || !isValid;

    const isPending = createEventMutation.isPending || createCouponMutation.isPending;

    return (
        <>
            <PageHeader crumbs={[{ label: tNav("events"), href: "/" }]} title={t("heading")} titleAsText />

            <PageContent width="default">
                <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t("heading")}</h1>

                <form onSubmit={handleSubmit(onSubmit)} className="divide-y">
                    <FieldSet title={t("sectionBasics")} description={t("sectionBasicsHelp")}>
                        <Field>
                            <FieldLabel htmlFor="title">{t("title")}</FieldLabel>
                            <Input
                                id="title"
                                type="text"
                                required
                                minLength={3}
                                maxLength={200}
                                placeholder={t("titlePlaceholder")}
                                {...register("title")}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="description">{t("description")}</FieldLabel>
                            <Textarea
                                id="description"
                                required
                                minLength={10}
                                maxLength={5000}
                                rows={5}
                                placeholder={t("descriptionPlaceholder")}
                                {...register("description")}
                            />
                        </Field>
                    </FieldSet>

                    <FieldSet title={t("sectionSchedule")} description={t("sectionScheduleHelp")}>
                        <Field>
                            <FieldLabel htmlFor="location">{t("location")}</FieldLabel>
                            <Input
                                id="location"
                                type="text"
                                required
                                minLength={3}
                                maxLength={500}
                                placeholder={t("locationPlaceholder")}
                                {...register("location")}
                            />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="startDate">{t("startDate")}</FieldLabel>
                                <Input id="startDate" type="datetime-local" required {...register("startDate")} />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="endDate">{t("endDate")}</FieldLabel>
                                <Input id="endDate" type="datetime-local" required {...register("endDate")} />
                            </Field>
                        </div>
                    </FieldSet>

                    <FieldSet title={t("sectionTickets")} description={t("sectionTicketsHelp")}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="capacity">{t("capacity")}</FieldLabel>
                                <Input
                                    id="capacity"
                                    type="number"
                                    required
                                    min={1}
                                    step={1}
                                    max={100000}
                                    className="tabular-nums"
                                    {...register("capacity", { valueAsNumber: true })}
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="ticketPrice">{t("ticketPrice")}</FieldLabel>
                                <Input
                                    id="ticketPrice"
                                    type="number"
                                    required
                                    min={0}
                                    step={0.1}
                                    className="tabular-nums"
                                    {...register("ticketPrice", { valueAsNumber: true })}
                                />
                            </Field>
                        </div>
                        <Field>
                            <FieldLabel>{t("image")}</FieldLabel>
                            <EventImageField
                                onChange={key =>
                                    setValue("imageUploadKey", key, { shouldValidate: true, shouldDirty: true })
                                }
                            />
                            <FieldDescription>{t("imageHelp")}</FieldDescription>
                        </Field>
                    </FieldSet>

                    <FieldSet title={t("sectionPromotion")} description={t("sectionPromotionHelp")}>
                        <div className="flex items-center gap-2.5">
                            <Checkbox
                                id="addCoupon"
                                checked={coupon.enabled}
                                onCheckedChange={checked => patchCoupon({ enabled: checked === true })}
                            />
                            <Label htmlFor="addCoupon" className="font-normal">
                                {t("addCoupon")}
                            </Label>
                        </div>

                        {coupon.enabled && (
                            <div className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
                                <Field>
                                    <FieldLabel htmlFor="couponCode">{t("couponCode")}</FieldLabel>
                                    <Input
                                        id="couponCode"
                                        type="text"
                                        value={coupon.code}
                                        onChange={e => patchCoupon({ code: e.target.value })}
                                        className="font-mono uppercase placeholder:normal-case"
                                        placeholder="EARLY20"
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="couponType">{t("discountType")}</FieldLabel>
                                    <NativeSelect
                                        id="couponType"
                                        value={coupon.discountType}
                                        onChange={e => patchCoupon({ discountType: e.target.value as CouponForm["discountType"] })}
                                    >
                                        <option value="PERCENTAGE">{t("percentage")}</option>
                                        <option value="FIXED">{t("fixed")}</option>
                                    </NativeSelect>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="couponValue">{t("discountValue", { type: coupon.discountType })}</FieldLabel>
                                    <Input
                                        id="couponValue"
                                        type="number"
                                        min={1}
                                        className="tabular-nums"
                                        value={coupon.discountValue}
                                        onChange={e => patchCoupon({ discountValue: Number(e.target.value) })}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="couponMax">{t("maxUses")}</FieldLabel>
                                    <Input
                                        id="couponMax"
                                        type="number"
                                        min={1}
                                        className="tabular-nums"
                                        value={coupon.maxUsages}
                                        onChange={e => patchCoupon({ maxUsages: Number(e.target.value) })}
                                    />
                                </Field>
                                <Field className="sm:col-span-2">
                                    <FieldLabel htmlFor="couponExpires">{t("expires")}</FieldLabel>
                                    <Input
                                        id="couponExpires"
                                        type="datetime-local"
                                        value={coupon.expiresAt}
                                        onChange={e => patchCoupon({ expiresAt: e.target.value })}
                                    />
                                </Field>
                            </div>
                        )}
                    </FieldSet>

                    <div className="flex items-center justify-end gap-2 pt-6">
                        <Button type="button" variant="ghost" onClick={() => router.push("/")}>
                            {tc("cancel")}
                        </Button>
                        <Button type="submit" disabled={isSubmitButtonDisabled}>
                            {isPending && <Spinner />}
                            {createEventMutation.isPending ? t("creating") : t("submit")}
                        </Button>
                    </div>
                </form>
            </PageContent>
        </>
    );
}
