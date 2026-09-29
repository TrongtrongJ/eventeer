import { http, HttpResponse } from 'msw';
import { apiUrl } from '../lib/orpc/config';
import { extractCookieValue, mockEvent, userForToken, wrapPaginated, wrapResponse } from './fixtures';

export const nodeHandlers = [
  http.get(`${apiUrl}/auth/me`, ({ request }) => {
    const token = extractCookieValue(request.headers.get('cookie'), 'access_token');
    const user = userForToken(token);
    if (!user) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return HttpResponse.json(wrapResponse(user), { status: 200 });
  }),

  http.get(`${apiUrl}/events`, () => HttpResponse.json(wrapPaginated([mockEvent]), { status: 200 })),

  http.get(`${apiUrl}/events/:id`, ({ params }) => {
    if (params.id !== mockEvent.id) {
      return HttpResponse.json({ message: 'Event not found' }, { status: 404 });
    }
    return HttpResponse.json(wrapResponse(mockEvent), { status: 200 });
  }),
];
