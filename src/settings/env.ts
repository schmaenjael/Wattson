export const REQUIRED_ENV_VARS: (keyof Environment)[] = [
  'TOKEN',
  'CLIENT_ID',
  'APPLICATION_ID',
  'GUILD_ID',
  'ADMIN_USER_ID',
  'NODE_ENV',
  'POSTGRES_DB',
  'POSTGRES_HOST',
  'BOT_USERNAME',
  'BOT_PASSWORD',
] as const;
