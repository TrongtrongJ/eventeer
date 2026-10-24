import { ResilienceModule } from '@nestjs/resilience';

function isError(error: any): error is NodeJS.ErrnoException {
    return error instanceof Error;
}

export enum RESILIENCE_PRESET {
  CARRIER = 'carrier',
  STRIPE = 'stripe',
  SMTP = 'smtp',
  OAUTH = 'OAuth',
  REDIS_SESSION = 'redis-session'
}

export function registerResilienceModule() {
  return ResilienceModule.forRoot({
    defaults: {
      timeout: '5s',
      retry: { attempts: 3, backoff: { delay: '200ms', maxDelay: '2s' } },
    },
    presets: {
      [RESILIENCE_PRESET.CARRIER]: {
        timeout: '2s',
        retry: { attempts: 2 },
        circuitBreaker: { failureRateThreshold: 50, minimumCalls: 10, openDuration: '30s', },
      },
      [RESILIENCE_PRESET.STRIPE]: {
        timeout: '10s',
        retry: { attempts: 2 },
        circuitBreaker: { 
          failureRateThreshold: 50, 
          minimumCalls: 10, 
          openDuration: '30s', 
          halfOpenMaxCalls: 1,
        }
      },
      [RESILIENCE_PRESET.SMTP]: {
        timeout: '10s',
        retry: { attempts: 2 },
        circuitBreaker: { 
          failureRateThreshold: 50, 
          minimumCalls: 10, 
          slidingWindow: {
            type: 'count',
            size: 5
          },
          openDuration: '30s', 
          halfOpenMaxCalls: 1,
          recordIf: (err: unknown) => isError(err) && err.code?.at(0) === '5',
        }
      },
      [RESILIENCE_PRESET.OAUTH]: {
        timeout: '5s',
        retry: { attempts: 2 },
        circuitBreaker: { 
          failureRateThreshold: 50, 
          minimumCalls: 10,
          openDuration: '30s', 
          halfOpenMaxCalls: 1,
        }
      },
      [RESILIENCE_PRESET.REDIS_SESSION]: {
        timeout: '200ms',
        retry: { attempts: 2 },
        circuitBreaker: { 
          openDuration: '15s',
          slidingWindow: {
            type: 'count',
            size: 5
          },
          halfOpenMaxCalls: 1,
          recordIf: () => true
        }
      }
    },
  })
};