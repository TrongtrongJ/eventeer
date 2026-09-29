export async function register() {
  // Only intercept in the Node.js runtime (not edge, where middleware.ts
  // runs) and only when explicitly opted into via the e2e test runner -
  // this must never activate in real dev or production.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.MOCK_API === '1') {
    const { setupServer } = await import('msw/node');
    const { nodeHandlers } = await import('./mocks/node-handlers');

    const server = setupServer(...nodeHandlers);
    server.listen({ onUnhandledRequest: 'bypass' });

    // eslint-disable-next-line no-console
    console.log('[e2e] Node-side MSW mock server started for Server Components/route handlers');
  }
}
