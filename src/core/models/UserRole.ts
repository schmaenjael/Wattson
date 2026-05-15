import { Snowflake } from 'discord.js';

export enum Permission {
  Unregistered = 'unregistered', // Unregistered user
  Community = 'community', // Community member
  Member = 'member', // Organization member
  Moderation = 'moderation', // General Moderation permissions
  Administration = 'administration', // Administration permissions
}

export interface UserRole {
  readonly roleId: Snowflake;
  readonly permissions: Permission[];
}
