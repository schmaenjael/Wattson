import { Snowflake } from 'discord.js';

export enum Permission {
  Unregistered = 'unregistered', // Unregistered user
  Community = 'community', // Community member
  Member = 'member', // Organization member
  EventManager = 'eventmanager', // Event management permissions
  Moderation = 'moderation', // General Moderation permissions
  Administration = 'administration', // Administration permissions
}

export interface UserRole {
  readonly roleId: Snowflake;
  readonly permissions: Permission[];
}
