import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/** Establishes the Mongoose connection; exits the process on failure. */
const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI as string);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection error: ${(error as Error).message}`);
    process.exit(1);
  }
};

/** Cleanly closes the Mongoose connection during graceful shutdown. */
export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error(`MongoDB disconnect error: ${(error as Error).message}`);
  }
};

export default connectDB;
