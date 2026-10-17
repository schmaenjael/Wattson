import { createServer, type Server } from 'node:http';

import { sql } from 'drizzle-orm';

import { getConfig } from '~/config';
import { AppFeature } from '~/settings';
import { Logger, logSoftFailure } from '~/utilities';
import { getDb } from '~/database';
import type { Client } from '~/core/models';

const DEFAULT_HEALTHCHECK_PORT = 30001;

let server: Server | null = null;

const resolvePort = (): number => {
  const parsed = Number(process.env.HEALTHCHECK_PORT);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_HEALTHCHECK_PORT;
};

/** Runs a lightweight `SELECT 1`, bounded by a short timeout; never throws (DB may be unconnected). */
const isDatabaseReady = async (): Promise<boolean> => {
  try {
    const probe = getDb().execute(sql`SELECT 1`);
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database health probe timed out.')), getConfig().config.timeouts.healthProbeMs).unref();
    });

    await Promise.race([probe, timeout]);
    return true;
  } catch (error) {
    logSoftFailure(AppFeature.Database, 'HEALTH_DATABASE_PROBE_FAILED', {}, error, 'error');
    return false;
  }
};

export const startHealthServer = (client: Client): Server => {
  const logger = Logger.getInstance(AppFeature.System);
  const port = resolvePort();

  server = createServer((request, response) => {
    void (async (): Promise<void> => {
      const path = (request.url ?? '').split('?')[0];

      if (request.method !== 'GET' || (path !== '/health' && path !== '/healthz')) {
        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'not_found' }));
        return;
      }

      const discord = client.isReady();
      const database = await isDatabaseReady();
      const healthy = discord && database;

      const body = { status: healthy ? 'ok' : 'degraded', discord, database, uptimeSeconds: Math.floor(process.uptime()) };

      response.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    })().catch((error: Error) => {
      logger.error(Object(error), 'Health check request handling failed.');
      if (!response.headersSent) {
        response.writeHead(503, { 'Content-Type': 'application/json' });
      }
      response.end(JSON.stringify({ status: 'degraded' }));
    });
  });

  server.on('error', (error: Error) => logger.error(Object(error), 'Health check server encountered an error.'));

  server.listen(port, () => logger.info({ port }, 'Health check server listening.'));

  return server;
};

export const stopHealthServer = async (): Promise<void> => {
  if (!server) return;

  const current = server;
  server = null;

  await new Promise<void>((resolve) => current.close(() => resolve()));
};
