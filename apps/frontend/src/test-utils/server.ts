import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export { validAccessToken, validRefreshToken } from './handlers';
export const server = setupServer(...handlers);

server.events.on('request:start', ({ request }) => {
  console.log('Outgoing:', request.method, request.url)
})

server.events.on('request:unhandled', ({ request }) => {
  console.error('FAILED TO MATCH:', request.method, request.url);
});

server.events.on('response:mocked', ({ request, response }) => {
  console.log('SUCCESSFUL MATCH:', request.url);
});