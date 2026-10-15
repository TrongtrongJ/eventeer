"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Info, MapPin, Tag, User as UserIcon, Users } from "lucide-react";
import { type CreateBookingDto, CreateBookingSchema, type UserDto, type EventDto } from "@packages/shared-schemas";
import { orpc } from "@/lib/orpc/query";
import { formatEventDate, seatsRemainingRatio } from "./helpers";
import { useMoney } from "@/i18n/hooks";
import { useFormatter, useTranslations } from "next-intl";
import { useToast } from "@/lib/toast/toast-context";
import { useSeatUpdates } from "@/hooks/useSeatUpdates";
import { cn } from "@/lib/utils";
import { PageContent, PageHeader } from "@/components/shell/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

interface EventDetailsClientProps {
    event: EventDto;
    isAuthenticated: boolean;
    user: UserDto | null;
}

/** One row of the Linear-style "properties" panel: icon + label on the left, value on the right. */
function Property({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4" />
                {label}
            </dt>
            <dd className="text-right font-medium">{children}</dd>
        </div>
    );
}

export function EventDetailsClient({ event, isAuthenticated, user }: EventDetailsClientProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const t = useTranslations("EventDetails");
    const tNav = useTranslations("Nav");
    const formatMoney = useMoney();
    const format = useFormatter();

    const { addToast } = useToast();
    const availableSeats = useSeatUpdates(event.id, event.availableSeats);

    const createBookingMutation = useMutation(orpc.bookings.createBooking.mutationOptions());

    const {
        register,
        watch,
        handleSubmit,
        formState: { isValid },
    } = useForm<CreateBookingDto>({
        resolver: zodResolver(CreateBookingSchema),
        defaultValues: {
            eventId: event.id,
            quantity: 1,
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            email: user?.email || "",
            couponCode: "",
        },
    });

    const onSubmit = useCallback(
        async (data: CreateBookingDto) => {
            try {
                const response = await createBookingMutation.mutateAsync(data);
                // Booking a seat changes the event's availableSeats - invalidate so
                // a back-navigation to the event/list doesn't show a stale count.
                await queryClient.invalidateQueries({ queryKey: orpc.events.key() });
                router.replace(`/checkout/${response.data.id}`);
            } catch (err: any) {
                // e.g. invalid / expired / sold-out coupon, sold-out event: the API's message is user-facing.
                addToast({ message: err?.message || t("bookingFailed"), type: "error" });
            }
        },
        [createBookingMutation, queryClient, router, addToast, t],
    );

    const quantity = watch("quantity");
    const maxTicketQuantity = Math.min(20, availableSeats);
    const totalPrice = event.ticketPrice * quantity;
    const formattedTotalPrice = formatMoney(totalPrice, event.currency);
    const selectedEventData = formatEventDate(format, event.startDate);
    const canPurchase = availableSeats > 0 && isAuthenticated;
    const isSubmitButtonDisabled = createBookingMutation.isPending || !isValid;
    const soldOut = availableSeats <= 0;
    const ratio = seatsRemainingRatio(availableSeats, event.capacity);
    const lowStock = !soldOut && ratio <= 0.15;

    return (
        <>
            <PageHeader crumbs={[{ label: tNav("events"), href: "/" }]} title={t("details")} titleAsText />

            <PageContent width="wide">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <article className="min-w-0 space-y-6">
                        {event.imageUrl && (
                            <img
                                src={event.imageUrl}
                                alt={event.title}
                                className="aspect-[21/9] w-full rounded-xl border object-cover"
                            />
                        )}

                        <header className="space-y-2">
                            <h1 className="text-2xl font-semibold tracking-tight text-balance">{event.title}</h1>
                            {event.organizerName && (
                                <p className="text-sm text-muted-foreground">
                                    {t.rich("organizedBy", {
                                        organizer: event.organizerName,
                                        name: chunks => <span className="font-medium text-foreground">{chunks}</span>,
                                    })}
                                </p>
                            )}
                        </header>

                        <p className="max-w-prose text-[15px] leading-relaxed whitespace-pre-line text-foreground/85">
                            {event.description}
                        </p>
                    </article>

                    <aside className="space-y-4 xl:sticky xl:top-17 xl:self-start">
                        <Card className="gap-0 py-0">
                            <CardHeader className="border-b py-3">
                                <CardTitle className="text-xs font-medium text-muted-foreground">{t("details")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="divide-y">
                                    <Property icon={CalendarDays} label={t("date")}>
                                        {selectedEventData}
                                    </Property>
                                    <Property icon={MapPin} label={t("location")}>
                                        {event.location}
                                    </Property>
                                    {event.organizerName && (
                                        <Property icon={UserIcon} label={t("organizer")}>
                                            {event.organizerName}
                                        </Property>
                                    )}
                                    <Property icon={Tag} label={t("price")}>
                                        {formatMoney(event.ticketPrice, event.currency)}
                                    </Property>
                                    <div className="space-y-2 py-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                <Users className="size-4" />
                                                {t("availability")}
                                            </span>
                                            {soldOut ? (
                                                <Badge variant="destructive">{t("soldOut")}</Badge>
                                            ) : (
                                                <span className={cn("font-medium tabular-nums", lowStock && "text-warning")}>
                                                    {availableSeats} / {event.capacity}
                                                </span>
                                            )}
                                        </div>
                                        <Progress
                                            value={ratio * 100}
                                            aria-label={t("availability")}
                                            indicatorClassName={cn(soldOut ? "bg-destructive" : lowStock ? "bg-warning" : "bg-success")}
                                        />
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>

                        {!isAuthenticated && (
                            <Alert variant="info">
                                <Info />
                                <AlertDescription>
                                    <span className="text-foreground">
                                        {t.rich("loginPrompt", {
                                            link: chunks => (
                                                <Link href="/login" className="font-medium underline underline-offset-4">
                                                    {chunks}
                                                </Link>
                                            ),
                                        })}
                                    </span>
                                </AlertDescription>
                            </Alert>
                        )}

                        {canPurchase && (
                            <Card className="gap-0 py-0">
                                <CardHeader className="border-b py-3">
                                    <CardTitle className="text-xs font-medium text-muted-foreground">{t("reserve")}</CardTitle>
                                </CardHeader>
                                <CardContent className="py-4">
                                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <Field>
                                                <FieldLabel htmlFor="firstName">{t("firstName")}</FieldLabel>
                                                <Input id="firstName" type="text" required {...register("firstName")} />
                                            </Field>
                                            <Field>
                                                <FieldLabel htmlFor="lastName">{t("lastName")}</FieldLabel>
                                                <Input id="lastName" type="text" required {...register("lastName")} />
                                            </Field>
                                        </div>

                                        <Field>
                                            <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
                                            <Input id="email" type="email" required {...register("email")} />
                                        </Field>

                                        <div className="grid grid-cols-[96px_1fr] gap-3">
                                            <Field>
                                                <FieldLabel htmlFor="quantity">{t("quantity")}</FieldLabel>
                                                <Input
                                                    id="quantity"
                                                    type="number"
                                                    min="1"
                                                    max={maxTicketQuantity}
                                                    required
                                                    className="tabular-nums"
                                                    {...register("quantity", { valueAsNumber: true })}
                                                />
                                            </Field>
                                            <Field>
                                                <FieldLabel htmlFor="couponCode">{t("couponCode")}</FieldLabel>
                                                <Input
                                                    id="couponCode"
                                                    type="text"
                                                    className="font-mono uppercase placeholder:normal-case"
                                                    placeholder={t("couponPlaceholder")}
                                                    {...register("couponCode")}
                                                />
                                            </Field>
                                        </div>

                                        <Separator />

                                        <div className="flex items-baseline justify-between">
                                            <span className="text-sm text-muted-foreground">{t("total")}</span>
                                            <span className="text-xl font-semibold tracking-tight tabular-nums">
                                                {formattedTotalPrice}
                                            </span>
                                        </div>

                                        <Button type="submit" disabled={isSubmitButtonDisabled} className="w-full" size="lg">
                                            {createBookingMutation.isPending && <Spinner />}
                                            {createBookingMutation.isPending ? t("processing") : t("proceed")}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        )}
                    </aside>
                </div>
            </PageContent>
        </>
    );
}
