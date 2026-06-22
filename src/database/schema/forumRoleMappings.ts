import { index, integer, pgTable, unique } from 'drizzle-orm/pg-core';

import { snowflake } from './shared';

export const forumRoleMappings = pgTable(
  'forum_role_mappings',
  { id: integer().primaryKey().generatedAlwaysAsIdentity(), channelId: snowflake().notNull(), roleId: snowflake().notNull() },
  (t) => [unique('forum_role_channel_role').on(t.channelId, t.roleId), index('forum_role_role_idx').on(t.roleId)]
);
