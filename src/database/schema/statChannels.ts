import { pgTable, varchar } from 'drizzle-orm/pg-core';

import { statChannelTypeEnum } from './enums';
import { SNOWFLAKE_LENGTH } from './shared';

export const statChannels = pgTable('stat_channels', {
  statType: statChannelTypeEnum().primaryKey(),
  channelId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
});
