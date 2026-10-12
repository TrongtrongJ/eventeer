"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/orpc/config";
import { useFormatter, useTranslations } from "next-intl";
import { getUptimeParts } from "./helpers";
import type { Metrics } from "./types";

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
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">{t("loadFailed")}</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`px-4 py-2 rounded-md ${autoRefresh ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                    >
                        {autoRefresh ? t("autoRefreshOn") : t("autoRefreshOff")}
                    </button>
                    <button
                        onClick={() => refetch()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                        {t("refreshNow")}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">{t("status")}</p>
                            <p
                                className={`text-2xl font-bold ${
                                    metrics.health.status === "healthy"
                                        ? "text-green-600"
                                        : metrics.health.status === "degraded"
                                          ? "text-yellow-600"
                                          : "text-red-600"
                                }`}
                            >
                                {t.has(`statusValues.${metrics.health.status}` as "statusValues.healthy")
                                    ? t(`statusValues.${metrics.health.status}` as "statusValues.healthy")
                                    : metrics.health.status.toUpperCase()}
                            </p>
                        </div>
                        <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                metrics.health.status === "healthy"
                                    ? "bg-green-100"
                                    : metrics.health.status === "degraded"
                                      ? "bg-yellow-100"
                                      : "bg-red-100"
                            }`}
                        >
                            {metrics.health.status === "healthy" ? "✓" : "⚠"}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 mb-1">{t("uptime")}</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {t("uptimeValue", getUptimeParts(metrics.health.uptime))}
                    </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 mb-1">{t("memoryUsage")}</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.health.memory.percentage}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {metrics.health.memory.used}MB / {metrics.health.memory.total}MB
                    </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 mb-1">{t("cpuUsage")}</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.health.cpu.usage}ms</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("events")}</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("totalEvents")}</span>
                            <span className="font-bold">{metrics.business.events.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("active")}</span>
                            <span className="font-bold text-green-600">{metrics.business.events.active}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("soldOut")}</span>
                            <span className="font-bold text-red-600">{metrics.business.events.soldOut}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("bookings")}</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("totalBookings")}</span>
                            <span className="font-bold">{metrics.business.bookings.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("confirmed")}</span>
                            <span className="font-bold text-green-600">{metrics.business.bookings.confirmed}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("totalRevenue")}</span>
                            <span className="font-bold text-indigo-600">
                                {formatCurrency(metrics.business.bookings.revenue.total)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("users")}</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("totalUsers")}</span>
                            <span className="font-bold">{metrics.business.users.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("active")}</span>
                            <span className="font-bold text-green-600">{metrics.business.users.active}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("newToday")}</span>
                            <span className="font-bold text-blue-600">{metrics.business.users.newToday}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("revenueGrowth")}</h3>
                <div className="grid grid-cols-3 gap-6">
                    <div>
                        <p className="text-sm text-gray-600 mb-1">{t("thisMonth")}</p>
                        <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(metrics.business.bookings.revenue.thisMonth)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 mb-1">{t("growth")}</p>
                        <p
                            className={`text-2xl font-bold ${
                                metrics.business.bookings.revenue.growth >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                        >
                            {metrics.business.bookings.revenue.growth >= 0 ? "+" : ""}
                            {metrics.business.bookings.revenue.growth.toFixed(1)}%
                        </p>
                    </div>
                </div>
            </div>

            {metrics.business.events.topEvents?.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("topEvents")}</h3>
                    <div className="space-y-3">
                        {metrics.business.events.topEvents.map((event, index) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                <div>
                                    <p className="font-medium text-gray-900">{event.title}</p>
                                    <p className="text-sm text-gray-600">
                                        {t("bookingsCount", { count: event.bookings })}
                                    </p>
                                </div>
                                <p className="text-lg font-bold text-indigo-600">{formatCurrency(event.revenue)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("apiPerformance")}</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("totalRequests")}</span>
                            <span className="font-bold">{metrics.requests.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("successRate")}</span>
                            <span className="font-bold text-green-600">
                                {((metrics.requests.success / metrics.requests.total) * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("avgResponse")}</span>
                            <span className="font-bold">{metrics.response.averageTime}ms</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("p95Response")}</span>
                            <span className="font-bold">{metrics.response.p95}ms</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("dbPerformance")}</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("totalQueries")}</span>
                            <span className="font-bold">{metrics.database.queries.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("slowQueries")}</span>
                            <span className="font-bold text-yellow-600">{metrics.database.queries.slow}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("queryErrors")}</span>
                            <span className="font-bold text-red-600">{metrics.database.queries.errors}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("avgQueryTime")}</span>
                            <span className="font-bold">{metrics.database.queries.averageTime}ms</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
