import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

interface ErrorResponse {
  status: 'error';
  message: string;
  errors?: Array<{ path: string; message: string }>;
}

/**
 * Global Express error handler.
 * Handles Zod validation errors, Mongoose validation errors, and generic errors.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(`❌ [Error Handler] ${err.name}: ${err.message}`);

  // Zod validation error
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      status: 'error',
      message: 'Validation failed',
      errors: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
    res.status(400).json(response);
    return;
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const response: ErrorResponse = {
      status: 'error',
      message: 'Database validation failed',
      errors: Object.entries(err.errors).map(([path, detail]) => ({
        path,
        message: detail.message,
      })),
    };
    res.status(400).json(response);
    return;
  }

  // Mongoose cast error (e.g. invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    const response: ErrorResponse = {
      status: 'error',
      message: `Invalid value for ${err.path}: ${String(err.value)}`,
    };
    res.status(400).json(response);
    return;
  }

  // Generic error
  const statusCode =
    'statusCode' in err &&
    typeof (err as Record<string, unknown>).statusCode === 'number'
      ? (err as Record<string, unknown>).statusCode as number
      : 500;

  const response: ErrorResponse = {
    status: 'error',
    message:
      statusCode === 500
        ? 'Internal server error'
        : err.message || 'Something went wrong',
  };

  res.status(statusCode).json(response);
}
