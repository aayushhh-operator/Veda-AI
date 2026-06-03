import mongoose from 'mongoose';
import { env } from './env';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export async function connectDB(): Promise<void> {
  let retries = 0;

  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err: Error) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      return;
    } catch (error) {
      retries++;
      const delay = BASE_DELAY_MS * Math.pow(2, retries - 1);
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(
        `❌ MongoDB connection attempt ${retries}/${MAX_RETRIES} failed: ${message}`,
      );

      if (retries >= MAX_RETRIES) {
        console.error(
          '❌ Max retries reached. Could not connect to MongoDB.',
        );
        process.exit(1);
      }

      console.log(`   Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
