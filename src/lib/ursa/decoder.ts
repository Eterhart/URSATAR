/**
 * Decodes a binary buffer (ArrayBuffer, Uint8Array, or Buffer) encoded in windows-874 (CP874) to a UTF-8 string.
 */
export function decodeWindows874(buffer: ArrayBuffer | Uint8Array): string {
  try {
    const decoder = new TextDecoder('windows-874', { fatal: false });
    return decoder.decode(buffer);
  } catch {
    try {
      const utf8 = new TextDecoder('utf-8', { fatal: false });
      return utf8.decode(buffer);
    } catch {
      const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      return Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength).toString('latin1');
    }
  }
}

/**
 * Helper to fetch binary body from a fetch Response and decode it as Windows-874.
 */
export async function decodeUrsaResponse(response: Response): Promise<string> {
  const arrayBuffer = await response.arrayBuffer();
  return decodeWindows874(arrayBuffer);
}

