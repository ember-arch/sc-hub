/**
 * An LZMA decoder for the packed streams inside OpenCTM model files (ADR-015). Written from the
 * LZMA specification (Igor Pavlov's public-domain LzmaSpec): a range decoder, the literal, length
 * and distance models and the twelve-state machine. It decodes a raw stream given its five
 * property bytes and its unpacked size, which is what OpenCTM stores. Pure; used at build time.
 */

const PROB_INIT = 1024;
const TOP = 1 << 24;

class RangeDecoder {
  private range = 0xffffffff;
  private code = 0;
  private pos: number;

  constructor(
    private readonly input: Uint8Array,
    start: number,
  ) {
    if (input[start] !== 0) throw new Error("lzma: bad stream start");
    this.pos = start + 1;
    for (let i = 0; i < 4; i += 1)
      this.code = ((this.code << 8) | this.next()) >>> 0;
    if (this.code === this.range) throw new Error("lzma: corrupted stream");
  }

  private next(): number {
    if (this.pos >= this.input.length)
      throw new Error("lzma: stream too short");
    return this.input[this.pos++]!;
  }

  private normalize(): void {
    if (this.range < TOP) {
      this.range = (this.range << 8) >>> 0;
      this.code = ((this.code << 8) | this.next()) >>> 0;
    }
  }

  bit(probs: Uint16Array, i: number): number {
    const p = probs[i]!;
    const bound = (this.range >>> 11) * p;
    let bit: number;
    if (this.code < bound) {
      this.range = bound;
      probs[i] = p + ((2048 - p) >>> 5);
      bit = 0;
    } else {
      this.range -= bound;
      this.code -= bound;
      probs[i] = p - (p >>> 5);
      bit = 1;
    }
    this.normalize();
    return bit;
  }

  direct(count: number): number {
    let result = 0;
    for (let i = 0; i < count; i += 1) {
      this.range >>>= 1;
      let bit = 0;
      if (this.code >= this.range) {
        this.code -= this.range;
        bit = 1;
      }
      result = ((result << 1) | bit) >>> 0;
      this.normalize();
    }
    return result;
  }

  tree(probs: Uint16Array, base: number, bits: number): number {
    let m = 1;
    for (let i = 0; i < bits; i += 1) m = (m << 1) | this.bit(probs, base + m);
    return m - (1 << bits);
  }

  reverse(probs: Uint16Array, base: number, bits: number): number {
    let m = 1;
    let symbol = 0;
    for (let i = 0; i < bits; i += 1) {
      const bit = this.bit(probs, base + m);
      m = (m << 1) | bit;
      symbol |= bit << i;
    }
    return symbol;
  }
}

class LenDecoder {
  private readonly choice = new Uint16Array(2).fill(PROB_INIT);
  private readonly low: Uint16Array;
  private readonly mid: Uint16Array;
  private readonly high = new Uint16Array(256).fill(PROB_INIT);

  constructor(posStates: number) {
    this.low = new Uint16Array(posStates << 3).fill(PROB_INIT);
    this.mid = new Uint16Array(posStates << 3).fill(PROB_INIT);
  }

  decode(rc: RangeDecoder, posState: number): number {
    if (rc.bit(this.choice, 0) === 0)
      return rc.tree(this.low, posState << 3, 3);
    if (rc.bit(this.choice, 1) === 0)
      return 8 + rc.tree(this.mid, posState << 3, 3);
    return 16 + rc.tree(this.high, 0, 8);
  }
}

/**
 * Decodes `size` bytes from a raw LZMA stream. `props` are the five property bytes (lc, lp and pb
 * packed in the first; the dictionary size in the other four, which a whole-buffer decode ignores).
 */
export function lzmaDecode(
  props: Uint8Array,
  input: Uint8Array,
  size: number,
): Uint8Array {
  let d = props[0]!;
  if (d >= 9 * 5 * 5) throw new Error("lzma: bad properties");
  const lc = d % 9;
  d = Math.floor(d / 9);
  const lp = d % 5;
  const pb = Math.floor(d / 5);

  const out = new Uint8Array(size);
  if (size === 0) return out;
  const rc = new RangeDecoder(input, 0);
  const literals = new Uint16Array(0x300 << (lc + lp)).fill(PROB_INIT);
  const posSlots = new Uint16Array(4 << 6).fill(PROB_INIT);
  const posDecoders = new Uint16Array(1 + 114).fill(PROB_INIT);
  const align = new Uint16Array(1 << 4).fill(PROB_INIT);
  const isMatch = new Uint16Array(12 << 4).fill(PROB_INIT);
  const isRep = new Uint16Array(12).fill(PROB_INIT);
  const isRepG0 = new Uint16Array(12).fill(PROB_INIT);
  const isRepG1 = new Uint16Array(12).fill(PROB_INIT);
  const isRepG2 = new Uint16Array(12).fill(PROB_INIT);
  const isRep0Long = new Uint16Array(12 << 4).fill(PROB_INIT);
  const lenDecoder = new LenDecoder(1 << pb);
  const repLenDecoder = new LenDecoder(1 << pb);

  const pbMask = (1 << pb) - 1;
  const lpMask = (1 << lp) - 1;
  let state = 0;
  let rep0 = 0;
  let rep1 = 0;
  let rep2 = 0;
  let rep3 = 0;
  let pos = 0;

  const distance = (len: number): number => {
    const lenState = Math.min(len, 3);
    const slot = rc.tree(posSlots, lenState << 6, 6);
    if (slot < 4) return slot;
    const directBits = (slot >>> 1) - 1;
    let dist = ((2 | (slot & 1)) << directBits) >>> 0;
    if (slot < 14) {
      dist += rc.reverse(posDecoders, dist - slot, directBits);
    } else {
      dist += rc.direct(directBits - 4) * 16;
      dist += rc.reverse(align, 0, 4);
    }
    return dist >>> 0;
  };

  while (pos < size) {
    const posState = pos & pbMask;
    if (rc.bit(isMatch, (state << 4) + posState) === 0) {
      const prev = pos > 0 ? out[pos - 1]! : 0;
      const base = 0x300 * (((pos & lpMask) << lc) + (prev >>> (8 - lc)));
      let symbol = 1;
      if (state >= 7) {
        let matchByte = out[pos - rep0 - 1]!;
        while (symbol < 0x100) {
          const matchBit = (matchByte >>> 7) & 1;
          matchByte <<= 1;
          const bit = rc.bit(literals, base + ((1 + matchBit) << 8) + symbol);
          symbol = (symbol << 1) | bit;
          if (matchBit !== bit) break;
        }
      }
      while (symbol < 0x100)
        symbol = (symbol << 1) | rc.bit(literals, base + symbol);
      out[pos++] = symbol & 0xff;
      state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6;
      continue;
    }
    let len: number;
    if (rc.bit(isRep, state) === 1) {
      if (pos === 0) throw new Error("lzma: repeat before any data");
      if (rc.bit(isRepG0, state) === 0) {
        if (rc.bit(isRep0Long, (state << 4) + posState) === 0) {
          state = state < 7 ? 9 : 11;
          out[pos] = out[pos - rep0 - 1]!;
          pos += 1;
          continue;
        }
      } else {
        let dist: number;
        if (rc.bit(isRepG1, state) === 0) {
          dist = rep1;
        } else {
          if (rc.bit(isRepG2, state) === 0) {
            dist = rep2;
          } else {
            dist = rep3;
            rep3 = rep2;
          }
          rep2 = rep1;
        }
        rep1 = rep0;
        rep0 = dist;
      }
      len = repLenDecoder.decode(rc, posState);
      state = state < 7 ? 8 : 11;
    } else {
      rep3 = rep2;
      rep2 = rep1;
      rep1 = rep0;
      len = lenDecoder.decode(rc, posState);
      state = state < 7 ? 7 : 10;
      rep0 = distance(len);
      if (rep0 === 0xffffffff) break;
      if (rep0 >= pos) throw new Error("lzma: distance beyond the data");
    }
    len += 2;
    for (let i = 0; i < len && pos < size; i += 1) {
      out[pos] = out[pos - rep0 - 1]!;
      pos += 1;
    }
  }
  if (pos !== size) throw new Error(`lzma: decoded ${pos} of ${size} bytes`);
  return out;
}
