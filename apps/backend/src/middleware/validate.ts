import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';

/**
 * Generic Zod validation middleware.
 * Validates req.body against the provided schema and replaces it
 * with the parsed (and potentially transformed) data on success.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const error = new ZodError(result.error.issues);
      next(error);
      return;
    }

    req.body = result.data;
    next();
  };
}
