export async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (text.trim() === "") return {};

  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function responseErrorMessage(
  body: Record<string, unknown>,
  fallback: string,
): string {
  return typeof body.error === "string" && body.error.trim() !== "" ? body.error : fallback;
}
