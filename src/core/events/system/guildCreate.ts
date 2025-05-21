import { eq } from 'drizzle-orm';

import DatabaseClient, { AppConfig, tblGuild, tblUsers, tblUsersInGuild } from '~/database';
import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';
import { Events, Guild } from 'discord.js';

export const insertAllUsersInGuild = async (guild: Guild) => {
  const db = DatabaseClient.getInstance();

  try {
    await guild.members.fetch();

    await db
      .insert(tblGuild)
      .values({
        id: guild.id,
        config: { system: { systemNotificationEnabled: false }, verification: { enabled: false }, surveillance: { enabled: false } } as AppConfig,
      })
      .onConflictDoNothing();

    const members = guild.members.cache.filter((m) => !m.user.bot);
    const usersToInsert = members.map((member) => ({ id: member.user.id, username: member.user.username, joinedDiscord: member.user.createdAt }));
    const usersInGuild = members.map((member) => ({ fkGuildId: guild.id, fkUserId: member.user.id }));

    await db.insert(tblUsers).values(usersToInsert).onConflictDoNothing();
    await db.insert(tblUsersInGuild).values(usersInGuild).onConflictDoNothing();

    console.log(`✅ Inserted ${usersInGuild.length} users into tblUsersInGuild for guild ${guild.name}`);
  } catch (err) {
    console.error(`❌ Failed to insert users for guild ${guild.name}:`, err);
  }
};

export default new Event({
  type: Events.GuildCreate,
  feature: AppFeature.Database,
  async executeCommand(event, client, guild) {
    const logger = Logger.getInstance();

    try {
      insertAllUsersInGuild(guild);

      logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
    } catch (error) {
      logger.error({ err: error }, `Failed to insert guild ${guild.id} into database.`);
    }
  },
});
