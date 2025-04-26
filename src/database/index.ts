import mongoose from 'mongoose';
import { AppFeature, ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export const loadDatabase = async (): Promise<void> => {
  const logger = Logger.getInstance(AppFeature.Database);
  let retries = 0;

  const connect = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI as string, {
        dbName: process.env.MONGO_INITDB_DATABASE,
        authSource: process.env.MONGO_INITDB_DATABASE,
        auth: { username: process.env.MONGO_USERNAME, password: process.env.MONGO_PASSWORD },
        authMechanism: 'DEFAULT',
        maxConnecting: 3,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        heartbeatFrequencyMS: 10000,
      });

      logger.info('Successfully connected to MongoDB.');
    } catch (error) {
      logger.error({ err: error }, `MongoDB connection attempt ${retries + 1} failed.`);

      if (retries++ < MAX_RETRIES) {
        logger.warn(`Retrying to connect to MongoDB in ${RETRY_DELAY_MS / 1000}s... (${retries}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return connect();
      } else {
        logger.fatal('Max retries reached. Could not connect to MongoDB. Exiting.');
        process.exit(ProcessExitCode.ERROR);
      }
    }
  };

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected.'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected.'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error.'));

  await connect();
};
