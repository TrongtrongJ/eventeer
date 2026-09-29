/**
 * The backend wraps every response in the envelope shape defined by
 * createBaseResponse / createPaginatedResponse in packages/contract. oRPC's
 * OpenAPILink validates responses against the contract's output schema, so
 * MSW mocks must match this envelope or the client-side call will throw a
 * validation error instead of returning the mocked data.
 */
export function wrapResponse<T>(data: T) {
  return {
    success: true,
    data,
    correlationId: 'test-correlation-id',
    timestamp: new Date().toISOString(),
  };
}

export function wrapPaginated<T>(items: T[], overrides: Partial<{ page: number; limit: number; total: number }> = {}) {
  const page = overrides.page ?? 1;
  const limit = overrides.limit ?? 20;
  const total = overrides.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    data: items,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    links: {
      first: '?page=1',
      previous: page > 1 ? `?page=${page - 1}` : null,
      next: page < totalPages ? `?page=${page + 1}` : null,
      last: `?page=${totalPages}`,
    },
    success: true,
    correlationId: 'test-correlation-id',
    timestamp: new Date().toISOString(),
  };
}
