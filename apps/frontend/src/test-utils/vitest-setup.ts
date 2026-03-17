import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers()); // critical — prevents handler bleed between tests
afterAll(() => server.close());