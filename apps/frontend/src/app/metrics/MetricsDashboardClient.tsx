"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/orpc/config";
import { useFormatter, useTranslations } from "next-intl";
import { getUptimeParts } from "./helpers";
import type { Metrics } from "./types";
import { cn } from "@/lib/utils";
import { PageContent, PageHeader } from "@/components/shell/PageHeader";
import { MetricsSkeleton } from "@/components/Loader/PageSkeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pause, RefreshCw } from "lucide-react";

async function fetchMetrics(): Promise<Metrics> {
    const [healthRes, metricsRes] = await Promise.all([
        fetch(`${apiUrl}/observability/health`, { credentials: "include" }).then(r => r.json()),
        fetch(`${apiUrl}/observability/metrics`, { credentials: "include" }).then(r => r.json()),
    ]);

    return {
        health: healthRes.data,
        ...metricsRes.data,
    };
}


function Stat({ label, children, hint, tone }: { label: string; children: React.ReactNode; hint?: React.ReactNode; tone?: "success" | "warning" | "danger" }) {
    return (
        <Card className="gap-1 py-4">
            <CardHeader className="gap-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
                <div
                    className={cn(
                        "text-2xl font-semibold tracking-tight tabular-nums",
                        tone === "success" && "text-success",
                        tone === "warning" && "text-warning",
                        tone === "danger" && "text-destructive",
                    )}
                >
                    {children}
                </div>
                {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
            </CardContent>
        </Card>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Card className="gap-0 py-0">
            <CardHeader className="border-b py-3">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y px-4">{children}</CardContent>
        </Card>
    );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "success" | "warning" | "danger" | "primary" }) {
    return (
        <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span
                className={cn(
                    "font-medium tabular-nums",
                    tone === "success" && "text-success",
                    tone === "warning" && "text-warning",
                    tone === "danger" && "text-destructive",
                    tone === "primary" && "text-primary dark:text-[#a3acff]",
                )}
            >
                {value}
            </span>
        </div>
    );
}

export function MetricsDashboardClient() {
    const t = useTranslations("Metrics");
    const format = useFormatter();
    const formatCurrency = (amount: number) => format.number(amount, { style: "currency", currency: "USD" });
    const [autoRefresh, setAutoRefresh] = useState(true);

    const {
        data: metrics,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ["observability", "metrics"],
        queryFn: fetchMetrics,
        refetchInterval: autoRefresh ? 30000 : false,
    });

    if (isLoading) {
        return (
            <>
                <PageHeader title={t("title")} />
                <MetricsSkeleton />
            </>
        );
    }

    if (!metrics) {
        return (
            <>
                <PageHeader title={t("title")} />
                <p className="py-12 text-center text-muted-foreground">{t("loadFailed")}</p>
            </>
        );
    }

    const status = metrics.health.status;
    const statusTone = status === "healthy" ? "success" : status === "degraded" ? "warning" : "danger";
    const growth = metrics.business.bookings.revenue.growth;

    return (
        <>
            <PageHeader
                title={t("title")}
                actions={
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            aria-pressed={autoRefresh}
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={cn(autoRefresh && "text-success")}
                        >
                            {autoRefresh ? <RefreshCw /> : <Pause />}
                            {autoRefresh ? t("autoRefreshOn") : t("autoRefreshOff")}
                        </Button>
                        <Button size="sm" onClick={() => refetch()}>
                            {t("refreshNow")}
                        </Button>
                    </>
                }
            />

            <PageContent width="wide" className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Stat label={t("status")} tone={statusTone}>
                        {t.has(`statusValues.${status}` as "statusValues.healthy")
                            ? t(`statusValues.${status}` as "statusValues.healthy")
                            : status.toUpperCase()}
                    </Stat>
                    <Stat label={t("uptime")}>{t("uptimeValue", getUptimeParts(metrics.health.uptime))}</Stat>
                    <Stat
                        label={t("memoryUsage")}
                        hint={
                            <div className="space-y-1.5">
                                <Progress value={metrics.health.memory.percentage} />
                                <span className="tabular-nums">
                                    {metrics.health.memory.used}MB / {metrics.health.memory.total}MB
                                </span>
                            </div>
                        }
                    >
                        {metrics.health.memory.percentage}%
                    </Stat>
                    <Stat label={t("cpuUsage")}>{metrics.health.cpu.usage}ms</Stat>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Section title={t("events")}>
                        <Row label={t("totalEvents")} value={metrics.business.events.total} />
                        <Row label={t("active")} value={metrics.business.events.active} tone="success" />
                        <Row label={t("soldOut")} value={metrics.business.events.soldOut} tone="danger" />
                    </Section>
                    <Section title={t("bookings")}>
                        <Row label={t("totalBookings")} value={metrics.business.bookings.total} />
                        <Row label={t("confirmed")} value={metrics.business.bookings.confirmed} tone="success" />
                        <Row label={t("totalRevenue")} value={formatCurrency(metrics.business.bookings.revenue.total)} tone="primary" />
                    </Section>
                    <Section title={t("users")}>
                        <Row label={t("totalUsers")} value={metrics.business.users.total} />
                        <Row label={t("active")} value={metrics.business.users.active} tone="success" />
                        <Row label={t("newToday")} value={metrics.business.users.newToday} />
                    </Section>
                </div>

                <Section title={t("revenueGrowth")}>
                    <Row label={t("thisMonth")} value={formatCurrency(metrics.business.bookings.revenue.thisMonth)} />
                    <Row
                        label={t("growth")}
                        value={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`}
                        tone={growth >= 0 ? "success" : "danger"}
                    />
                </Section>

                {metrics.business.events.topEvents?.length > 0 && (
                    <Card className="gap-0 overflow-hidden py-0">
                        <CardHeader className="border-b py-3">
                            <CardTitle className="text-sm font-medium">{t("topEvents")}</CardTitle>
                        </CardHeader>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>{t("events")}</TableHead>
                                    <TableHead className="text-right">{t("bookings")}</TableHead>
                                    <TableHead className="text-right">{t("totalRevenue")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {metrics.business.events.topEvents.map((event, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{event.title}</TableCell>
                                        <TableCell className="text-right text-muted-foreground tabular-nums">
                                            {t("bookingsCount", { count: event.bookings })}
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatCurrency(event.revenue)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <Section title={t("apiPerformance")}>
                        <Row label={t("totalRequests")} value={metrics.requests.total} />
                        <Row
                            label={t("successRate")}
                            value={`${((metrics.requests.success / metrics.requests.total) * 100).toFixed(1)}%`}
                            tone="success"
                        />
                        <Row label={t("avgResponse")} value={`${metrics.response.averageTime}ms`} />
                        <Row label={t("p95Response")} value={`${metrics.response.p95}ms`} />
                    </Section>
                    <Section title={t("dbPerformance")}>
                        <Row label={t("totalQueries")} value={metrics.database.queries.total} />
                        <Row label={t("slowQueries")} value={metrics.database.queries.slow} tone="warning" />
                        <Row label={t("queryErrors")} value={metrics.database.queries.errors} tone="danger" />
                        <Row label={t("avgQueryTime")} value={`${metrics.database.queries.averageTime}ms`} />
                    </Section>
                </div>
            </PageContent>
        </>
    );
}
