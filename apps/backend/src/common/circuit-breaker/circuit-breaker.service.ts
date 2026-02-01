import { Injectable, Logger } from '@nestjs/common';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
  resetTimeout: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<string, CircuitBreakerState> = new Map();

  private getDefaultConfig(): CircuitBreakerConfig {
    return {
      threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
      timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000'),
      resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
    };
  }

  async execute<T>(
    circuitName: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>,
  ): Promise<T> {
    const circuitConfig = { ...this.getDefaultConfig(), ...config };
    const circuit = this.getOrCreateCircuit(circuitName, circuitConfig);

    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() - circuit.openedAt < circuitConfig.timeout) {
        this.logger.warn({
          message: 'Circuit is OPEN, executing fallback',
          circuit: circuitName,
          failures: circuit.failures,
        });

        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker is OPEN (Error) for ${circuitName}`);
      } else {
        this.logger.log({
          message: 'Attempting to a HALF_OPEN circuit',
          circuit: circuitName,
        });
        circuit.state = CircuitState.HALF_OPEN;
      }
    }

    try {
      const result = await fn();
      this.onSuccess(circuitName);
      return result;
    } catch (error) {
      this.onFailure(circuitName);

      // if (fallback && circuit.state === CircuitState.OPEN) {
      if (fallback && circuit.state === CircuitState.HALF_OPEN) {
        this.logger.warn({
          message: 'Executing fallback after failure',
          circuit: circuitName,
          error: error.message,
        });
        return fallback();
      }

      throw error;
    }
  }

  private getOrCreateCircuit(name: string, config: CircuitBreakerConfig): CircuitBreakerState {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        state: CircuitState.CLOSED,
        failures: 0,
        openedAt: 0,
        config,
      });
    }
    return this.circuits.get(name)!;
  }

  private onSuccess(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (!circuit) return;

    if (circuit.state === CircuitState.HALF_OPEN) {
      this.logger.log({
        message: 'Circuit HALF_OPEN success, resetting to CLOSED (functional)',
        circuit: circuitName,
      });
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
    } else if (circuit.state === CircuitState.CLOSED && circuit.failures > 0) {
      circuit.failures = Math.max(0, circuit.failures - 1);
    }
  }

  private onFailure(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (!circuit) return;

    circuit.failures++;

    this.logger.warn({
      message: 'Circuit failure recorded',
      circuit: circuitName,
      failures: circuit.failures,
      threshold: circuit.config.threshold,
      state: circuit.state,
    });

    if (circuit.failures >= circuit.config.threshold) {
      circuit.state = CircuitState.OPEN;
      circuit.openedAt = Date.now();

      this.logger.error({
        message: 'Circuit breaker OPENED',
        circuit: circuitName,
        failures: circuit.failures,
        threshold: circuit.config.threshold,
      });

      setTimeout(() => {
        this.logger.log({
          message: 'Circuit breaker reset timeout expired, setting to HALF_OPEN',
          circuit: circuitName,
        });
        circuit.state = CircuitState.HALF_OPEN;
      }, circuit.config.resetTimeout);
    }
  }

  getCircuitState(circuitName: string): string {
    return this.circuits.get(circuitName)?.state || CircuitState.CLOSED;
  }

  getCircuitStatistics(circuitName: string) {
    const circuit = this.circuits.get(circuitName);
    if (!circuit) return null;

    return {
      name: circuitName,
      state: circuit.state,
      failures: circuit.failures,
      threshold: circuit.config.threshold,
      openedAt: circuit.openedAt > 0 ? new Date(circuit.openedAt) : null,
    };
  }

  getAllCircuitsStatistics() {
    const stats = [];
    for (const [name, circuit] of this.circuits.entries()) {
      stats.push({
        name,
        state: circuit.state,
        failures: circuit.failures,
        threshold: circuit.config.threshold,
      });
    }
    return stats;
  }
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  openedAt: number;
  config: CircuitBreakerConfig;
}
