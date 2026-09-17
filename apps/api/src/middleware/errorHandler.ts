import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn('Operational error', {
      id: req.id,
      statusCode: err.statusCode,
      message: err.message,
      path: req.path,
    });

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Unexpected errors — log full details but never expose to client
  logger.error('Unhandled error', {
    id: req.id,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: 'Something went wrong. Please try again.',
  });
}
