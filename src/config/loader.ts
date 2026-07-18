import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import JSON5 from 'json5';
import { ZodError } from 'zod';

import { ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';

import { catalogSchema, configSchema, envSchema, rulesSchema, type AppConfig, type Catalog, type Env, type RulesConfig } from './schema';

const CONFIG_DIR = join(process.cwd(), 'config');
const CONFIG_PATH = join(CONFIG_DIR, `config.${process.env.NODE_ENV}.json5`);
const CATALOG_PATH = join(CONFIG_DIR, 'catalog.json5');
const RULES_PATH = join(CONFIG_DIR, 'rules.json5');

let cached: { env: Env; config: AppConfig; catalog: Catalog; rules: RulesConfig['rules'] } | null = null;

const readJson5 = (path: string): unknown => JSON5.parse(readFileSync(path, 'utf-8')) as unknown;

/**
 * Validates `process.env`, the per-environment `config/config.<NODE_ENV>.json5`, and the two static
 * catalogs (`config/catalog.json5`, `config/rules.json5`) against the Zod schemas and caches the
 * result in memory. The static catalogs are environment-independent reference data — loaded the same
 * way regardless of NODE_ENV. All files are JSON5, so comments and trailing commas are permitted.
 * Must be called once, first thing at boot. A validation or read failure logs the offending issues
 * and exits the process — there is no DB fallback for configuration anymore.
 */
export const loadConfig = (): void => {
  const logger = Logger.getInstance();

  try {
    const env = envSchema.parse(process.env);
    const config = configSchema.parse(readJson5(CONFIG_PATH));
    const catalog = catalogSchema.parse(readJson5(CATALOG_PATH));
    const { rules } = rulesSchema.parse(readJson5(RULES_PATH));

    if (config.features.harmDetection && !env.OLLAMA_MODEL) {
      logger.fatal('Harm detection is enabled but OLLAMA_MODEL is not set.');
      process.exit(ProcessExitCode.CONFIG);
    }

    cached = { env, config, catalog, rules };
    logger.info('Configuration loaded and validated from environment, config.json5, catalog.json5 and rules.json5.');
  } catch (error) {
    if (error instanceof ZodError) {
      logger.fatal({ issues: error.issues }, 'Configuration validation failed.');
    } else {
      logger.fatal(Object(error), 'Failed to read or parse a configuration file.');
    }
    process.exit(ProcessExitCode.CONFIG);
  }
};

/** Returns the validated, in-memory configuration. Throws if {@link loadConfig} has not run. */
export const getConfig = (): { env: Env; config: AppConfig; catalog: Catalog; rules: RulesConfig['rules'] } => {
  if (!cached) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return cached;
};
