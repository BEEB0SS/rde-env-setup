export async function postJson<T>(
  baseUrl: string,
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${path}: ${text}`);
  }

  return (await res.json()) as T;
}
