import { describe, expect, it } from 'vitest';
import {
  BROTLI_PAYLOAD_PREFIX,
  brotliCompressBuffer,
  brotliDecompressBuffer,
  decodeDataPayload,
  encodeDataPayload,
  isBrotliPayload,
  packQueueRows,
  resolveBrotliDataOptions,
  unpackQueueRows,
} from '../../src/utils/brotli.util';

const LARGE = {
  items: Array.from({ length: 200 }, (_, i) => ({
    id: i,
    name: `Hostel Ghar resident ${i}`,
    room: `${i + 100}`,
  })),
};

describe('brotli npm data compression', () => {
  it('round-trips buffers through the brotli npm package', () => {
    const raw = Buffer.from(JSON.stringify(LARGE), 'utf8');
    const compressed = brotliCompressBuffer(raw);
    expect(compressed.length).toBeLessThan(raw.length);
    expect(brotliDecompressBuffer(compressed).toString('utf8')).toBe(raw.toString('utf8'));
  });

  it('encodes large payloads as br1: and decodes them back', () => {
    const encoded = encodeDataPayload(LARGE);
    expect(encoded.startsWith(BROTLI_PAYLOAD_PREFIX)).toBe(true);
    expect(isBrotliPayload(encoded)).toBe(true);
    expect(encoded.length).toBeLessThan(JSON.stringify(LARGE).length);
    expect(decodeDataPayload(encoded)).toEqual(LARGE);
  });

  it('leaves small payloads as plain JSON', () => {
    const encoded = encodeDataPayload({ ok: true });
    expect(isBrotliPayload(encoded)).toBe(false);
    expect(encoded).toBe(JSON.stringify({ ok: true }));
  });

  it('decodes legacy plain-JSON rows written before Brotli', () => {
    expect(decodeDataPayload(JSON.stringify(LARGE))).toEqual(LARGE);
  });

  it('resolves env knobs with safe clamps', () => {
    expect(resolveBrotliDataOptions().quality).toBe(4);
    expect(resolveBrotliDataOptions({ quality: 99 }).quality).toBe(11);
    expect(resolveBrotliDataOptions({ quality: -5 }).quality).toBe(0);
  });

  it('packs large BullMQ rows into rowsBr and unpacks them back', () => {
    const rows = LARGE.items.map((item, index) => ({
      line: index + 2,
      name: item.name,
      email: `resident${index}@example.com`,
      phone: '9841000001',
      room: item.room,
      bed: 'B1',
      rent: 11000,
      raw: {},
    }));
    const packed = packQueueRows({ importId: 'imp-1', rows });
    expect(packed.rowsBr?.startsWith(BROTLI_PAYLOAD_PREFIX)).toBe(true);
    expect(packed.rows).toEqual([]);
    const rawJson = JSON.stringify({ rows });
    const packedJson = JSON.stringify(packed);
    expect(packedJson.length).toBeLessThan(rawJson.length);
    expect(unpackQueueRows(packed)).toEqual({ importId: 'imp-1', rows });
  });

  it('unpacks legacy queue payloads that were never packed', () => {
    const legacy = { importId: 'imp-0', rows: [{ line: 2 }] };
    expect(unpackQueueRows(legacy)).toEqual(legacy);
    const small = packQueueRows({ importId: 'imp-0', rows: [{ line: 2 }] });
    expect(small.rowsBr).toBeUndefined();
  });

  it('survives the JSON round trip BullMQ performs on job data', () => {
    const rows = LARGE.items.map((item, index) => ({
      line: index + 2,
      name: item.name,
      room: item.room,
      raw: {},
    }));
    const packed = packQueueRows({
      importId: 'imp-2',
      hostelId: 'h-1',
      ownerId: 'o-1',
      requestedByRole: 'owner',
      rows,
      hostelName: 'Hostel Ghar',
    });
    // BullMQ stores job.data as JSON and rehydrates it on the worker side.
    const asWorkerSeesIt = JSON.parse(JSON.stringify(packed));
    expect(unpackQueueRows(asWorkerSeesIt)).toEqual({
      importId: 'imp-2',
      hostelId: 'h-1',
      ownerId: 'o-1',
      requestedByRole: 'owner',
      rows,
      hostelName: 'Hostel Ghar',
    });
  });
});
