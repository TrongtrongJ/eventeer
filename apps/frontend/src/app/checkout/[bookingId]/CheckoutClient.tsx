"use client";

import { SubmitEvent, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { BookingDto } from "@packages/shared-schemas";
import { orpc } from "@/lib/orpc/query";
import { stripePublishableKey } from "@/lib/orpc/config";
import { useMoney } from "@/i18n/hooks";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Clock, FlaskConical, ShieldAlert } from "lucide-react";
import { useToast } from "@/lib/toast/toast-context";
import FullScreenLoader from "@/components/Loader/FullScreenLoader";
import { PageContent, PageHeader } from "@/components/shell/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyActions, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

// No publishable key = demo mode (the API is in mock-payments mode too): no Stripe.js at all.
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

/** Shared "payment finished, now let the API verify and issue tickets" step. */
function useFinalizeBooking(bookingId: string) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const t = useTranslations("Checkout");
    const confirmBooking = useMutation(orpc.bookings.confirmBooking.mutationOptions());

    return useCallback(async () => {
        await confirmBooking.mutateAsync({ id: bookingId });
        await queryClient.invalidateQueries({ queryKey: orpc.bookings.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.events.key() });
        addToast({ message: t("success"), type: "success" });
        router.push(`/booking/${bookingId}`);
    }, [confirmBooking, queryClient, addToast, router, bookingId, t]);
}

function StripeCheckoutForm({ booking }: { booking: BookingDto }) {
    const stripe = useStripe();
    const elements = useElements();
    const { addToast } = useToast();
    const t = useTranslations("Checkout");
    const formatMoney = useMoney();
    const [isProcessing, setIsProcessing] = useState(false);
    const finalize = useFinalizeBooking(booking.id);

    const handleSubmit = useCallback(
        async (e: SubmitEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (!stripe || !elements) return;
            setIsProcessing(true);

            try {
                const { error: submitError } = await elements.submit();
                if (submitError) throw new Error(submitError.message);

                const { error: paymentError } = await stripe.confirmPayment({
                    elements,
                    confirmParams: { return_url: `${window.location.origin}/booking/${booking.id}` },
                    redirect: "if_required",
                });
                if (paymentError) throw new Error(paymentError.message);

                await finalize();
            } catch (error: any) {
                addToast({ message: error?.message || t("failed"), type: "error" });
                setIsProcessing(false);
            }
        },
        [stripe, elements, booking.id, finalize, addToast, t],
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Card className="gap-4">
                <CardHeader>
                    <CardTitle>{t("paymentDetails")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <PaymentElement />
                </CardContent>
            </Card>
            <Button type="submit" size="lg" disabled={!stripe || isProcessing} className="w-full">
                {isProcessing && <Spinner />}
                {isProcessing
                    ? t("processing")
                    : t("pay", { amount: formatMoney(booking.finalAmount, booking.currency) })}
            </Button>
        </form>
    );
}

/** Demo mode: lets the whole booking flow be exercised without a payment provider. */
function DemoCheckoutForm({ booking }: { booking: BookingDto }) {
    const { addToast } = useToast();
    const t = useTranslations("Checkout");
    const formatMoney = useMoney();
    const [isProcessing, setIsProcessing] = useState(false);
    const finalize = useFinalizeBooking(booking.id);

    const handlePay = useCallback(async () => {
        setIsProcessing(true);
        try {
            await finalize();
        } catch (error: any) {
            addToast({ message: error?.message || t("failed"), type: "error" });
            setIsProcessing(false);
        }
    }, [finalize, addToast, t]);

    return (
        <div className="space-y-4">
            <Alert variant="warning">
                <FlaskConical />
                <AlertDescription>
                    <p className="text-foreground">
                        {t.rich("demoNotice", {
                            strong: chunks => <strong>{chunks}</strong>,
                            code: chunks => (
                                <code className="mx-0.5 rounded bg-muted px-1 py-0.5 font-mono text-xs">{chunks}</code>
                            ),
                        })}
                    </p>
                </AlertDescription>
            </Alert>
            <Button type="button" size="lg" onClick={handlePay} disabled={isProcessing} className="w-full">
                {isProcessing && <Spinner />}
                {isProcessing
                    ? t("processing")
                    : t("payDemo", { amount: formatMoney(booking.finalAmount, booking.currency) })}
            </Button>
        </div>
    );
}

function SeatHoldNotice({ expiresAt }: { expiresAt?: string | null }) {
    const t = useTranslations("Checkout");
    const format = useFormatter();
    if (!expiresAt) return null;
    return (
        <Alert variant="info">
            <Clock />
            <AlertDescription>
                <p className="text-foreground">
                    {t.rich("seatHold", {
                        when: format.dateTime(new Date(expiresAt), { hour: "2-digit", minute: "2-digit" }),
                        time: chunks => <span className="font-medium tabular-nums">{chunks}</span>,
                    })}
                </p>
            </AlertDescription>
        </Alert>
    );
}

export function CheckoutClient({ bookingId }: { bookingId: string }) {
    const router = useRouter();
    const t = useTranslations("Checkout");
    const tc = useTranslations("Common");
    const tNav = useTranslations("Nav");
    const locale = useLocale();
    const { resolvedTheme } = useTheme();
    const formatMoney = useMoney();
    const { data, isLoading } = useQuery(orpc.bookings.findOne.queryOptions({ input: { id: bookingId } }));
    const booking = data?.data;

    if (isLoading) return <FullScreenLoader message={t("loading")} />;
    if (!booking) return null;

    // Already paid (e.g. back button after paying): go straight to the tickets.
    if (booking.status === "CONFIRMED") {
        router.replace(`/booking/${booking.id}`);
        return null;
    }

    // Hold lapsed / cancelled: the seats are gone, so there is nothing left to pay for.
    if (booking.status !== "PENDING") {
        return (
            <>
                <PageHeader title={t("title")} />
                <Empty className="min-h-[50vh]">
                    <EmptyMedia>
                        <ShieldAlert />
                    </EmptyMedia>
                    <EmptyHeader>
                        <EmptyTitle>{t("inactiveTitle")}</EmptyTitle>
                        <EmptyDescription>{t("inactiveBody", { status: booking.status })}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyActions>
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/events/${booking.eventId}`}>{t("backToEvent")}</Link>
                        </Button>
                    </EmptyActions>
                </Empty>
            </>
        );
    }

    return (
        <>
            <PageHeader crumbs={[{ label: tNav("events"), href: "/" }]} title={t("title")} />

            <PageContent width="wide">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="min-w-0 space-y-4">
                        <h1 className="sr-only">{t("title")}</h1>
                        <SeatHoldNotice expiresAt={booking.expiresAt} />

                        {stripePromise && booking.clientSecret ? (
                            <Elements
                                stripe={stripePromise}
                                options={{
                                    locale, // Stripe's own UI + card error messages follow the app language
                                    clientSecret: booking.clientSecret,
                                    appearance: {
                                        // Match the app theme so the card form does not glow white on the dark UI.
                                        theme: resolvedTheme === "light" ? "stripe" : "night",
                                        variables: {
                                            colorPrimary: "#5e6ad2",
                                            borderRadius: "6px",
                                            fontFamily: "Inter, system-ui, sans-serif",
                                        },
                                    },
                                }}
                            >
                                <StripeCheckoutForm booking={booking} />
                            </Elements>
                        ) : (
                            <DemoCheckoutForm booking={booking} />
                        )}
                    </div>

                    <aside className="lg:sticky lg:top-17 lg:self-start">
                        <Card className="gap-0 py-0">
                            <CardHeader className="border-b py-3">
                                <CardTitle className="text-xs font-medium text-muted-foreground">{t("orderSummary")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 py-4 text-sm">
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">{t("quantity")}</span>
                                    <span className="font-medium tabular-nums">{tc("ticketCount", { count: booking.quantity })}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">{t("subtotal")}</span>
                                    <span className="tabular-nums">{formatMoney(booking.totalAmount, booking.currency)}</span>
                                </div>
                                {booking.discount > 0 && (
                                    <div className="flex justify-between gap-4 text-success">
                                        <span>{t("discount", { code: booking.couponCode ?? "" })}</span>
                                        <span className="tabular-nums">-{formatMoney(booking.discount, booking.currency)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="font-medium">{t("total")}</span>
                                    <span className="text-lg font-semibold tracking-tight tabular-nums">
                                        {formatMoney(booking.finalAmount, booking.currency)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </PageContent>
        </>
    );
}
