import { Snowflake } from 'discord.js';

export enum Permission {
  Verifying = 0, // Verifying as Community member
  Applying = 1, // Applying as Party member
  Moderation = 2, // General Moderation permissions
  Administration = 3, // Administration permissions
}

export class UserRole {
  public readonly roleId: Snowflake;
  public readonly permissions: Permission[];

  constructor(roleId: Snowflake, permissions: Permission[] = []) {
    this.roleId = roleId;
    this.permissions = permissions;
  }
}
