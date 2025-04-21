import { Snowflake } from 'discord.js';

export enum Permission {
  Verifying = 0, // Verifying as Community member
  Applying = 1, // Applying as Party member
  Moderation = 2, // General Moderation permissions
  Administration = 3, // Administration permissions
}

export interface UserRole {
  readonly roleId: Snowflake;
  readonly permissions: Permission[];
}
