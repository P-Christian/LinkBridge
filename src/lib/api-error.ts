// Marker comments so a collapsed 500 handler keeps its cause in the server log.
export function safeErrorMessage(err: unknown, message: string): string {
  console.error(`[api] ${message}`, err);
  return message;
}
