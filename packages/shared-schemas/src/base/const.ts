export const sortOrder = ['ASC', 'DESC'] as const;
export type SortOrder = typeof sortOrder[number];