// Shared token-user mapping store
// In production, this would be stored in a database or Redis
// For development, we use an in-memory Map

export const tokenUserMap = new Map<string, any>();
