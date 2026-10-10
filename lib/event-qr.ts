import QRCode from 'qrcode';

const TARGET = 640;
const MARGIN = 4;

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i += 1) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function zlibStore(data: Uint8Array) {
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  const blockSize = 65535;
  for (let offset = 0; offset < data.length; offset += blockSize) {
    const end = Math.min(offset + blockSize, data.length);
    const length = end - offset;
    const block = new Uint8Array(5 + length);
    block[0] = end === data.length ? 1 : 0;
    block[1] = length & 255;
    block[2] = (length >> 8) & 255;
    const complement = length ^ 0xffff;
    block[3] = complement & 255;
    block[4] = (complement >> 8) & 255;
    block.set(data.subarray(offset, end), 5);
    parts.push(block);
  }
  const sum = adler32(data);
  parts.push(new Uint8Array([(sum >>> 24) & 255, (sum >>> 16) & 255, (sum >>> 8) & 255, sum & 255]));
  return concat(parts);
}

function chunk(type: string, data: Uint8Array) {
  const typeBytes = Uint8Array.from(type, (char) => char.charCodeAt(0));
  const crc = crc32(concat([typeBytes, data]));
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc);
  return out;
}

function encodePng(width: number, height: number, raw: Uint8Array) {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 2;
  return concat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlibStore(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}

function bytesToBase64(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += alphabet[(triple >> 18) & 63];
    out += alphabet[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? alphabet[triple & 63] : '=';
  }
  return out;
}

export function eventQrPngBase64(url: string) {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const modules = qr.modules.data;
  const scale = TARGET / (count + MARGIN * 2);
  const symbolSize = Math.floor((count + MARGIN * 2) * scale);
  const scaledMargin = MARGIN * scale;
  const rowBytes = 1 + symbolSize * 3;
  const raw = new Uint8Array(rowBytes * symbolSize);

  for (let y = 0; y < symbolSize; y += 1) {
    const row = y * rowBytes;
    for (let x = 0; x < symbolSize; x += 1) {
      let dark = false;
      if (
        y >= scaledMargin &&
        x >= scaledMargin &&
        y < symbolSize - scaledMargin &&
        x < symbolSize - scaledMargin
      ) {
        const rowIndex = Math.floor((y - scaledMargin) / scale);
        const colIndex = Math.floor((x - scaledMargin) / scale);
        dark = Boolean(modules[rowIndex * count + colIndex]);
      }
      const offset = row + 1 + x * 3;
      const value = dark ? 0 : 255;
      raw[offset] = value;
      raw[offset + 1] = value;
      raw[offset + 2] = value;
    }
  }

  return bytesToBase64(encodePng(symbolSize, symbolSize, raw));
}
