import { GuildMember, PermissionFlagsBits } from 'discord.js';

import { Permission } from '~/core/models/Permission';
import type { Settings } from '~/database';

export const ROLE_COLUMN_BY_PERMISSION: Record<Permission, keyof Settings> = {
  [Permission.Unregistered]: 'roleUnregisteredId',
  [Permission.Community]: 'roleCommunityId',
  [Permission.Member]: 'roleMemberId',
  [Permission.EventManager]: 'roleEventManagerId',
  [Permission.Moderation]: 'roleModerationId',
  [Permission.Administration]: 'roleAdministrationId',
};

const memberHasPermissionRole = (member: GuildMember, settings: Settings, permission: Permission): boolean => {
  const roleId = settings[ROLE_COLUMN_BY_PERMISSION[permission]] as string | null;
  return roleId !== null && member.roles.cache.has(roleId);
};

/**
 * AND semantics: member must hold every required permission-role.
 * Used by `usePermissions` for slash-command gating.
 * Bootstrap fallback: bare `ManageGuild` passes only while the admin role is unconfigured.
 */
export const memberHasAllPermissions = (member: GuildMember, settings: Settings, required: Permission[]): boolean => {
  if (!settings.roleAdministrationId && member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  return required.every((permission) => memberHasPermissionRole(member, settings, permission));
};

/**
 * OR semantics: member passes if they hold any of the listed permission-roles,
 * or hold `ManageGuild`. Used by the interaction route dispatcher for component/modal `rights`.
 * Mirrors the historical inline moderator checks on button handlers.
 */
export const memberHasAnyPermission = (member: GuildMember, settings: Settings, allowed: Permission[]): boolean => {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  return allowed.some((permission) => memberHasPermissionRole(member, settings, permission));
};
