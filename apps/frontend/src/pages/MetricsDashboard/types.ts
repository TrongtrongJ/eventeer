
interface TopEvent {
  title: string;
  bookings: number;
  revenue: number;
}
export interface Metrics {
  health: {
    status: string;
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      loadAverage: number[];
    };
  };
  requests: {
    total: number;
    success: number;
    errors: number;
    byEndpoint: Record<string, number>;
  };
  response: {
    averageTime: number;
    p95: number;
    p99: number;
  };
  database: {
    queries: {
      total: number;
      slow: number;
      errors: number;
      averageTime: number;
    };
  };
  business: {
    events: {
      total: number;
      active: number;
      soldOut: number;
      topEvents: TopEvent[];
    };
    bookings: {
      total: number;
      confirmed: number;
      revenue: {
        total: number;
        thisMonth: number;
        growth: number;
      };
    };
    users: {
      total: number;
      active: number;
      newToday: number;
      newThisWeek: number;
    };
  };
}