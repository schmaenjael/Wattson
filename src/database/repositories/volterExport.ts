import { eq } from 'drizzle-orm';

import { getDb } from '../client';
import { voltVerifications } from '../schema/voltVerifications';
import { users } from '../schema/users';

export type VolterExportRow = { discordUserId: string; username: string | null; logtoSub: string; verifiedAt: Date; expiresAt: Date };

export const getVerifiedVolters = async (): Promise<VolterExportRow[]> => {
  const db = getDb();
  return db
    .select({
      discordUserId: voltVerifications.discordUserId,
      username: users.username,
      logtoSub: voltVerifications.logtoSub,
      verifiedAt: voltVerifications.verifiedAt,
      expiresAt: voltVerifications.expiresAt,
    })
    .from(voltVerifications)
    .leftJoin(users, eq(users.id, voltVerifications.discordUserId));
};
