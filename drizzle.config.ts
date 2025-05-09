import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './scripts/migrations',
  schema: './src/database/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT) ?? 5432,
    user: process.env.BOT_USERNAME,
    password: process.env.BOT_PASSWORD,
    database: process.env.POSTGRES_DB,
    ssl: false,
  },
});
