import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  eventLoop: {
    lag: number;
  };
  process: {
    pid: number;
    version: string;
    platform: string;
  };
}

export interface ApplicationMetrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    byEndpoint: Record<string, number>;
    byMethod: Record<string, number>;
    byStatusCode: Record<string, number>;
  };
  response: {
    averageTime: number;
    p50: number;
    p95: number;
    p99: number;
    slowest: { endpoint: string; duration: number }[];
  };
  database: {
    connections: {
      active: number;
      idle: number;
      total: number;
    };
    queries: {
      total: number;
      slow: number;
      errors: number;
      averageTime: number;
    };
  };
  redis: {
    connected: boolean;
    memoryUsage: number;
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  business: {
    events: {
      total: number;
      active: number;
      soldOut: number;
    };
    bookings: {
      total: number;
      pending: number;
      confirmed: number;
      cancelled: number;
      revenue: number;
    };
    users: {
      total: number;
      active: number;
      byRole: Record<string, number>;
    };
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private startTime = Date.now();

  // Request metrics
  private requestCount = 0;
  private successCount = 0;
  private errorCount = 0;
  private requestsByEndpoint = new Map<string, number>();
  private requestsByMethod = new Map<string, number>();
  private requestsByStatus = new Map<number, number>();

  // Response time tracking
  private responseTimes: number[] = [];
  private slowestRequests: Array<{ endpoint: string; duration: number; timestamp: number }> = [];

  // Database metrics
  private queryCount = 0;
  private slowQueryCount = 0;
  private queryErrors = 0;
  private queryTimes: number[] = [];

  // Redis metrics
  private redisHits = 0;
  private redisMisses = 0;

  constructor(private readonly configService: ConfigService) {
    // Start periodic cleanup of old metrics
    setInterval(() => this.cleanupOldMetrics(), 60000); // Every minute
  }

  // Request metrics
  recordRequest(method: string, endpoint: string, statusCode: number, duration: number) {
    this.requestCount++;

    if (statusCode >= 200 && statusCode < 400) {
      this.successCount++;
    } else if (statusCode >= 400) {
      this.errorCount++;
    }

    // Track by endpoint
    const current = this.requestsByEndpoint.get(endpoint) || 0;
    this.requestsByEndpoint.set(endpoint, current + 1);

    // Track by method
    const methodCount = this.requestsByMethod.get(method) || 0;
    this.requestsByMethod.set(method, methodCount + 1);

    // Track by status code
    const statusCount = this.requestsByStatus.get(statusCode) || 0;
    this.requestsByStatus.set(statusCode, statusCount + 1);

    // Track response time
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }

    // Track slowest requests
    if (duration > 1000) {
      // Slower than 1 second
      this.slowestRequests.push({ endpoint, duration, timestamp: Date.now() });
      this.slowestRequests.sort((a, b) => b.duration - a.duration);
      if (this.slowestRequests.length > 10) {
        this.slowestRequests = this.slowestRequests.slice(0, 10);
      }
    }
  }

  // Database metrics
  recordQuery(duration: number, error = false) {
    this.queryCount++;

    if (error) {
      this.queryErrors++;
    }

    if (duration > 100) {
      // Slower than 100ms
      this.slowQueryCount++;
      this.logger.warn({
        message: 'Slow query detected',
        duration: `${duration}ms`,
      });
    }

    this.queryTimes.push(duration);
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }
  }

  // Redis metrics
  recordCacheHit() {
    this.redisHits++;
  }

  recordCacheMiss() {
    this.redisMisses++;
  }

  // Get health metrics
  async getHealthMetrics(): Promise<HealthMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = Date.now() - this.startTime;

    // Calculate event loop lag
    const start = Date.now();
    await new Promise((resolve) => setImmediate(resolve));
    const lag = Date.now() - start;

    const memoryUsed = memUsage.heapUsed;
    const memoryTotal = memUsage.heapTotal;
    const memoryPercentage = (memoryUsed / memoryTotal) * 100;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (memoryPercentage > 90 || lag > 100) {
      status = 'unhealthy';
    } else if (memoryPercentage > 80 || lag > 50) {
      status = 'degraded';
    }

    return {
      status,
      uptime: Math.floor(uptime / 1000), // seconds
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      cpu: {
        usage: Math.round((cpuUsage.user + cpuUsage.system) / 1000), // ms
        loadAverage: process.platform === 'linux' ? require('os').loadavg() : [0, 0, 0],
      },
      eventLoop: {
        lag: Math.round(lag),
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
      },
    };
  }

  // Get application metrics
  getApplicationMetrics(): Partial<ApplicationMetrics> {
    const avgResponseTime = this.calculateAverage(this.responseTimes);
    const [p50, p95, p99] = this.calculatePercentiles(this.responseTimes, [50, 95, 99]);
    const avgQueryTime = this.calculateAverage(this.queryTimes);

    const totalCacheRequests = this.redisHits + this.redisMisses;
    const hitRate =
      totalCacheRequests > 0 ? Math.round((this.redisHits / totalCacheRequests) * 100) : 0;

    return {
      requests: {
        total: this.requestCount,
        success: this.successCount,
        errors: this.errorCount,
        byEndpoint: Object.fromEntries(this.requestsByEndpoint),
        byMethod: Object.fromEntries(this.requestsByMethod),
        byStatusCode: Object.fromEntries(this.requestsByStatus),
      },
      response: {
        averageTime: Math.round(avgResponseTime),
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99),
        slowest: this.slowestRequests.slice(0, 5),
      },
      database: {
        connections: {
          active: 0, // Would need TypeORM connection pool access
          idle: 0,
          total: 0,
        },
        queries: {
          total: this.queryCount,
          slow: this.slowQueryCount,
          errors: this.queryErrors,
          averageTime: Math.round(avgQueryTime),
        },
      },
      redis: {
        connected: true, // Would check actual Redis connection
        memoryUsage: 0, // Would get from Redis INFO
        keys: 0,
        hits: this.redisHits,
        misses: this.redisMisses,
        hitRate,
      },
    };
  }

  // Get business metrics (would be populated by repositories)
  async getBusinessMetrics(): Promise<Partial<ApplicationMetrics['business']>> {
    return {
      events: {
        total: 0,
        active: 0,
        soldOut: 0,
      },
      bookings: {
        total: 0,
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        revenue: 0,
      },
      users: {
        total: 0,
        active: 0,
        byRole: {},
      },
    };
  }

  // Get Prometheus-style metrics
  getPrometheusMetrics(): string {
    const metrics: string[] = [];

    // Request metrics
    metrics.push(`# HELP http_requests_total Total number of HTTP requests`);
    metrics.push(`# TYPE http_requests_total counter`);
    metrics.push(`http_requests_total ${this.requestCount}`);

    metrics.push(`# HELP http_requests_success Total number of successful HTTP requests`);
    metrics.push(`# TYPE http_requests_success counter`);
    metrics.push(`http_requests_success ${this.successCount}`);

    metrics.push(`# HELP http_requests_errors Total number of failed HTTP requests`);
    metrics.push(`# TYPE http_requests_errors counter`);
    metrics.push(`http_requests_errors ${this.errorCount}`);

    // Response time
    const avgResponseTime = this.calculateAverage(this.responseTimes);
    metrics.push(`# HELP http_response_time_ms Average HTTP response time in milliseconds`);
    metrics.push(`# TYPE http_response_time_ms gauge`);
    metrics.push(`http_response_time_ms ${avgResponseTime.toFixed(2)}`);

    // Database metrics
    metrics.push(`# HELP db_queries_total Total number of database queries`);
    metrics.push(`# TYPE db_queries_total counter`);
    metrics.push(`db_queries_total ${this.queryCount}`);

    metrics.push(`# HELP db_queries_slow Number of slow database queries`);
    metrics.push(`# TYPE db_queries_slow counter`);
    metrics.push(`db_queries_slow ${this.slowQueryCount}`);

    // Cache metrics
    metrics.push(`# HELP cache_hits_total Total number of cache hits`);
    metrics.push(`# TYPE cache_hits_total counter`);
    metrics.push(`cache_hits_total ${this.redisHits}`);

    metrics.push(`# HELP cache_misses_total Total number of cache misses`);
    metrics.push(`# TYPE cache_misses_total counter`);
    metrics.push(`cache_misses_total ${this.redisMisses}`);

    return metrics.join('\n');
  }

  // Reset metrics (useful for testing)
  reset() {
    this.requestCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.requestsByEndpoint.clear();
    this.requestsByMethod.clear();
    this.requestsByStatus.clear();
    this.responseTimes = [];
    this.slowestRequests = [];
    this.queryCount = 0;
    this.slowQueryCount = 0;
    this.queryErrors = 0;
    this.queryTimes = [];
    this.redisHits = 0;
    this.redisMisses = 0;
  }

  // Helper methods
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  private calculatePercentiles(values: number[], percentiles: number[]): number[] {
    if (values.length === 0) return percentiles.map(() => 0);

    const sorted = [...values].sort((a, b) => a - b);
    return percentiles.map((p) => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)] || 0;
    });
  }

  private cleanupOldMetrics() {
    // Remove slow requests older than 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.slowestRequests = this.slowestRequests.filter((req) => req.timestamp > fiveMinutesAgo);
  }
}
