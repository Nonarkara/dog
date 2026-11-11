/** Read JSON objects within the route's byte budget, including streamed bodies. */
export async function readJsonObject(request: Request, limit: number): Promise<
  { value: Record<string, unknown> } | { status: 400 | 413 }
> {
  if (Number(request.headers.get('Content-Length')) > limit) return { status: 413 };
  if (!request.body) return { status: 400 };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        void reader.cancel().catch(() => {});
        return { status: 413 };
      }
      text += decoder.decode(value, { stream: true });
    }
    const value: unknown = JSON.parse(text + decoder.decode());
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { value: value as Record<string, unknown> }
      : { status: 400 };
  } catch {
    return { status: 400 };
  } finally {
    reader.releaseLock();
  }
}
