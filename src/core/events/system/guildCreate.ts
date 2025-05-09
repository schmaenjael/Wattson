import { eq } from 'drizzle-orm';

import DatabaseClient, { AppConfig, tblGuild } from '~/database';
import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';

export default new Event({
  name: 'guildCreate',
  feature: AppFeature.Database,
  async executeCommand(client, guild) {
    const logger = Logger.getInstance();

    try {
      logger.info(`Joined new guild: ${guild.name} (${guild.id})`);

      const db = DatabaseClient.getInstance();

      const existing = await db.select().from(tblGuild).where(eq(tblGuild.guildId, guild.id)).limit(1);

      if (existing.length > 0) {
        logger.warn(`Guild ${guild.id} already exists in database. Skipping insert.`);
        return;
      }

      await db
        .insert(tblGuild)
        .values({
          guildId: guild.id,
          config: { system: { systemNotificationEnabled: false }, verification: { enabled: false }, surveillance: { enabled: false } } as AppConfig,
        });

      logger.info(`Inserted guild ${guild.id} into database.`);
    } catch (error) {
      logger.error({ err: error }, `Failed to insert guild ${guild.id} into database.`);
    }
  },
});
