// Load and validate env vars FIRST — crashes immediately on bad config
import { env } from './config/env';

import express from 'express';
import { createServer } from 'http';
import { connectDB } from './config/db';
import { initWebSocket } from './services/wsService';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';
import assignmentsRouter from './routes/assignments';
import papersRouter from './routes/papers';

// ─── Express App ─────────────────────────────────────────────────────────────

const app = express();

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '100mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/assignments', assignmentsRouter);
app.use('/api/papers', papersRouter);

// Error handler (must be last)
app.use(errorHandler);

// ─── HTTP + WebSocket Server ─────────────────────────────────────────────────

const server = createServer(app);

async function start(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectDB();

    // Attach WebSocket server
    initWebSocket(server);

    // Start listening
    server.listen(env.PORT, () => {
      console.log(`🚀 VedaAI backend running on port ${env.PORT}`);
      console.log(`   AI Provider: groq`);
      console.log(`   CORS origins: ${env.CORS_ORIGINS.join(', ')}`);
      console.log(`   Health check: http://localhost:${env.PORT}/health`);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to start server: ${message}`);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

function gracefulShutdown(signal: string): void {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  server.close(() => {
    console.log('   HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('   Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Start ───────────────────────────────────────────────────────────────────

start();
