import { describe, expect, it } from 'vitest';
import { STATUS_CODE } from '../../src/constant/statusCode.interface';

describe('STATUS_CODE', () => {
  it('exposes the standard success and error status codes', () => {
    expect(STATUS_CODE.OK).toBe(200);
    expect(STATUS_CODE.CREATED).toBe(201);
    expect(STATUS_CODE.BAD_REQUEST).toBe(400);
    expect(STATUS_CODE.NOT_FOUND).toBe(404);
    expect(STATUS_CODE.INTERNAL_SERVER_ERROR).toBe(500);
  });
});
