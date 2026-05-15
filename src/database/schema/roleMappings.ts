import { pgTable, serial, unique, varchar } from 'drizzle-orm/pg-core';

import { roleMappingTypeEnum, RoleMappingType } from './enums';
import { SNOWFLAKE_LENGTH } from './shared';

export const roleMappings = pgTable(
  'role_mappings',
  {
    id: serial().primaryKey(),
    type: roleMappingTypeEnum().notNull().$type<RoleMappingType>(),
    value: varchar({ length: 50 }).notNull(),
    roleId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
  },
  (t) => [unique('role_mapping_type_value').on(t.type, t.value)]
);
