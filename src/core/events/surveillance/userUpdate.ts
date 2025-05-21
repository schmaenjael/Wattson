import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import DatabaseClient, { tblUsernameHistory } from '~/database';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';

export default new Event({
  type: Events.GuildMemberUpdate,
  feature: AppFeature.Surveillance,
  middleware: [],
  async executeCommand(event, client, oldUser, newUser) {
    const logger = Logger.getInstance(AppFeature.Surveillance);
    const db = DatabaseClient.getInstance();

    console.log('DETECTED CHANGE');

    const comparisonItems: (keyof typeof oldUser)[] = ['displayName'];

    const changes = comparisonItems
      .filter((field) => oldUser[field] !== newUser[field])
      .map((field) => ({ field, old: oldUser[field], new: newUser[field] }));

    console.log(changes);

    for (const { field, new: updatedField } of changes) {
      logger.info(`${newUser.nickname} (${newUser.id}) changed ${field} to ${updatedField}.`);

      if (field == 'displayName')
        await db
          .insert(tblUsernameHistory)
          .values({ fkUserId: newUser.id, username: String(updatedField) })
          .onConflictDoNothing();
    }
  },
});
