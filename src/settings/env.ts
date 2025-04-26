export const REQUIRED_ENV_VARS: (keyof Environment)[] = [
  'TOKEN',
  'CLIENT_ID',
  'APPLICATION_ID',
  'NODE_ENV',
  'MONGO_URI',
  'MONGO_USERNAME',
  'MONGO_PASSWORD',
  'MONGO_INITDB_DATABASE',
] as const;
