import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import multer from 'multer';
import { errorHandler } from '../src/middleware/errorHandler';

describe('errorHandler', () => {
  it('responds with 500 and a generic error message', () => {
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    errorHandler(new Error('boom'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'internal server error' });
  });

  it('responds with 400 and a size-limit message for an oversized upload', () => {
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    const err = new multer.MulterError('LIMIT_FILE_SIZE');
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'image exceeds 5MB limit' });
  });
});
