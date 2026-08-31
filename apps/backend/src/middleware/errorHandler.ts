import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'image exceeds 5MB limit' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
}
