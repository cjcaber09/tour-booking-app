import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'image exceeds 5MB limit' : 'invalid file upload' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
}
