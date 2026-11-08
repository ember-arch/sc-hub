/**
 * The picture size of an MP4 file, read from its first video track's header box (`tkhd`), so a
 * render loop can keep its own proportions on the page (ADR-015). Returns null when the file has
 * no track with a size. Pure; no decoding.
 */
export function mp4Size(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = [0x74, 0x6b, 0x68, 0x64]; // "tkhd"
  for (let i = 4; i + 4 <= bytes.length; i += 1) {
    if (
      bytes[i] !== tag[0] ||
      bytes[i + 1] !== tag[1] ||
      bytes[i + 2] !== tag[2] ||
      bytes[i + 3] !== tag[3]
    )
      continue;
    const version = bytes[i + 4];
    // After the tag: version and flags (4); times, track id, reserved and duration (20, or 32 in
    // version 1); reserved (8); layer, group, volume and reserved (8); matrix (36); then the size.
    const sizeAt = i + 4 + 4 + (version === 1 ? 32 : 20) + 8 + 8 + 36;
    if (sizeAt + 8 > bytes.length) return null;
    const width = view.getUint32(sizeAt) / 65536;
    const height = view.getUint32(sizeAt + 4) / 65536;
    if (width > 0 && height > 0)
      return { width: Math.round(width), height: Math.round(height) };
  }
  return null;
}
