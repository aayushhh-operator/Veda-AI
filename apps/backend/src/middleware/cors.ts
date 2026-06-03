import cors from 'cors';
import type { CorsOptions } from 'cors';
import { env } from '../config/env';

export function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[] = env.CORS_ORIGINS,
): boolean {
  if (!origin) {
    return true;
  }
  if (allowedOrigins.includes('*')) {
    return true;
  }
  return allowedOrigins.includes(origin);
}

function buildCorsOptions(): CorsOptions {
  const allowedOrigins = env.CORS_ORIGINS;

  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition', 'Content-Length'],
    maxAge: 86400,
  };
}

export const corsMiddleware = cors(buildCorsOptions());
