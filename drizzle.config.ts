import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const POSTGRES_DEFAULT_PORT = 5432;

export default defineConfig({
  out: './scripts/migrations',
  schema: './src/database/schema/*.ts',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT ?? POSTGRES_DEFAULT_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    ssl: false,
  },
});
