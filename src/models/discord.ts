import { type CacheType, type Interaction, type SlashCommandBuilder } from 'discord.js';

export enum CommandType {
  Utility,
  Surveillance,
  Moderation,
  Stats,
}

export enum AccessLevel {
  User,
  ChatModerator,
  PartyMember,
}

export interface SlashCommand {
  type: CommandType;
  accessLevel: AccessLevel;
  data: SlashCommandBuilder;
  execute: (interaction: Interaction<CacheType>) => Promise<void>;
}
