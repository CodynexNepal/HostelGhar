export const formatError = (error: unknown): Record<string, string> => ({
  error: error instanceof Error ? error.message : String(error),
});
