import { REQUIRED_ENV_VARS } from '~/constants/env';
import { config } from 'dotenv';

import { Logger } from '~/models';

export const setupEnvironment = () => {
  const logger = Logger.getInstance();

  logger.info('Attempting to initalize environment variables and secrets.');

  config({ override: true });

  const missingVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missingVars.length > 0) {
    logger.fatal(`Detected missing environment variables ${missingVars.join(';')}.`);
    process.exit();
  }

  logger.info(`Successfully loaded ${REQUIRED_ENV_VARS.join(';')} from the environment.`);
  logger.info(`The environment is currently set to ${process.env.NODE_ENV} while running Node ${process.version}.`);
};
