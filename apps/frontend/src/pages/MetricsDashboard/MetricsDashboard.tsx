import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { apiClient } from '../../api/client';
import { formatUptime, formatCurrency } from './helpers'
import type { Metrics } from './types'

const MetricsDashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [ metrics, setMetrics ] = useState<Metrics | null>(null);
  const [ loading, setLoading ] = useState(true);
  const [ autoRefresh, setAutoRefresh ] = useState(true);

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchMetrics = async () => {
    try {
      const [ healthRes, metricsRes ] = await Promise.all([
        apiClient.get('/observability/health'),
        apiClient.get('/observability/metrics'),
      ]);

      setMetrics({
        health: healthRes.data.data,
        ...metricsRes.data.data,
      });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Failed to load metrics</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">System Metrics</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-md ${
              autoRefresh ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {autoRefresh ? '🔄 Auto-refresh ON' : '⏸ Auto-refresh OFF'}
          </button>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p
                className={`text-2xl font-bold ${
                  metrics.health.status === 'healthy'
                    ? 'text-green-600'
                    : metrics.health.status === 'degraded'
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {metrics.health.status.toUpperCase()}
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                metrics.health.status === 'healthy'
                  ? 'bg-green-100'
                  : metrics.health.status === 'degraded'
                  ? 'bg-yellow-100'
                  : 'bg-red-100'
              }`}
            >
              {metrics.health.status === 'healthy' ? '✓' : '⚠'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Uptime</p>
          <p className="text-2xl font-bold text-gray-900">{formatUptime(metrics.health.uptime)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Memory Usage</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.health.memory.percentage}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.health.memory.used}MB / {metrics.health.memory.total}MB
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">CPU Usage</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.health.cpu.usage}ms</p>
        </div>
      </div>

      {/* Business Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Events</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Events</span>
              <span className="font-bold">{metrics.business.events.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active</span>
              <span className="font-bold text-green-600">{metrics.business.events.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sold Out</span>
              <span className="font-bold text-red-600">{metrics.business.events.soldOut}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bookings</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Bookings</span>
              <span className="font-bold">{metrics.business.bookings.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Confirmed</span>
              <span className="font-bold text-green-600">
                {metrics.business.bookings.confirmed}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Revenue</span>
              <span className="font-bold text-indigo-600">
                {formatCurrency(metrics.business.bookings.revenue.total)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Users</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Users</span>
              <span className="font-bold">{metrics.business.users.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active</span>
              <span className="font-bold text-green-600">{metrics.business.users.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">New Today</span>
              <span className="font-bold text-blue-600">{metrics.business.users.newToday}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Growth */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Growth</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">This Month</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(metrics.business.bookings.revenue.thisMonth)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Growth</p>
            <p
              className={`text-2xl font-bold ${
                metrics.business.bookings.revenue.growth >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {metrics.business.bookings.revenue.growth >= 0 ? '+' : ''}
              {metrics.business.bookings.revenue.growth.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Top Events */}
      {metrics.business.events.topEvents?.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Events by Revenue</h3>
          <div className="space-y-3">
            {metrics.business.events.topEvents.map((event, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">{event.title}</p>
                  <p className="text-sm text-gray-600">{event.bookings} bookings</p>
                </div>
                <p className="text-lg font-bold text-indigo-600">{formatCurrency(event.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">API Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Requests</span>
              <span className="font-bold">{metrics.requests.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Success Rate</span>
              <span className="font-bold text-green-600">
                {((metrics.requests.success / metrics.requests.total) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Response Time</span>
              <span className="font-bold">{metrics.response.averageTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">P95 Response Time</span>
              <span className="font-bold">{metrics.response.p95}ms</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Database Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Queries</span>
              <span className="font-bold">{metrics.database.queries.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Slow Queries</span>
              <span className="font-bold text-yellow-600">{metrics.database.queries.slow}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Query Errors</span>
              <span className="font-bold text-red-600">{metrics.database.queries.errors}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Query Time</span>
              <span className="font-bold">{metrics.database.queries.averageTime}ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export { MetricsDashboard };
