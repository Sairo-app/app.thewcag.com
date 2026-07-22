export class RequestBodyTooLargeError extends Error {
  constructor(readonly maximumBytes: number) {
    super(`Request body exceeds ${maximumBytes} bytes`);
    this.name = "RequestBodyTooLargeError";
  }
}

async function readBoundedBytes(
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw new RequestBodyTooLargeError(maximumBytes);
  }
  if (!request.body) throw new SyntaxError("Request body is empty");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("Request body is too large").catch(() => undefined);
        throw new RequestBodyTooLargeError(maximumBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** Read text without trusting or requiring Content-Length. */
export async function readBoundedText(request: Request, maximumBytes: number): Promise<string> {
  return new TextDecoder("utf-8", { fatal: true }).decode(await readBoundedBytes(request, maximumBytes));
}

/** Read a JSON request without trusting or requiring Content-Length. */
export async function readBoundedJson(request: Request, maximumBytes: number): Promise<unknown> {
  return JSON.parse(await readBoundedText(request, maximumBytes));
}
