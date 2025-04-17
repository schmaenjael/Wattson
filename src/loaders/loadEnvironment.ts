import { REQUIRED_ENV_VARS } from '~/constants/env';
import { config } from 'dotenv';

import { Logger } from '~/models';
import { ProcessExitCode } from '~/constants';

export const loadEnvironment = async () => {
  const logger = Logger.getInstance();
  const missingVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  logger.info('Attempting to initalize environment variables and secrets.');

  const { error, parsed } = config({ override: true });

  if (missingVars.length > 0) {
    logger.fatal(`Detected missing environment variables ${missingVars.join(';')}.`);
    process.exit(ProcessExitCode.ERROR);
  }

  if (error) {
    logger.fatal(`Could not load environment variables due to an unforseen error: ${error.message}`);
    process.exit(ProcessExitCode.ERROR);
  }

  logger.info(`Successfully loaded ${REQUIRED_ENV_VARS.join('; ')} from the environment.`);
  logger.info(`The environment is currently set to ${process.env.NODE_ENV} while running Node ${process.version}.`);
};
