export const REQUIRED_ENV_VARS: (keyof Environment)[] = [
  'TOKEN',
  'CLIENT_ID',
  'APPLICATION_ID',
  'NODE_ENV',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'BOT_USERNAME',
  'BOT_PASSWORD',
  'POSTGRES_HOST',
] as const;
