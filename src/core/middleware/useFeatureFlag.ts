import { ApplicationCommandType, MessageFlags, RepliableInteraction } from 'discord.js';

import type { Client, Command } from '~/core/models';
import type { InteractionType, MiddlewareFunction, MiddlewareResult } from '~/core/types';
import { getSettings, type Settings } from '~/database';
import { L } from '~/core/locales';
import { ProcessExitCode } from '~/settings';

export type FeatureFlagKey = { [K in keyof Settings]: K extends `feature${string}Enabled` ? K : never }[keyof Settings];

/** Guards a user-initiated interaction (button/modal/select) behind a feature flag, replying ephemerally when off. */
export const ensureFeatureEnabled = async (interaction: RepliableInteraction, flag: FeatureFlagKey): Promise<boolean> => {
  const settings = await getSettings();
  if (settings[flag]) {
    return true;
  }

  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_FEATURE_DISABLED(), flags: MessageFlags.Ephemeral });
  }

  return false;
};

/** Command-level counterpart of {@link ensureFeatureEnabled}, attached via a command's own `middleware` array. */
export const useFeatureFlag = <T extends ApplicationCommandType>(flag: FeatureFlagKey): MiddlewareFunction<T> =>
  (async (_command: Command<T>, _client: Client, interaction: InteractionType<T>): Promise<MiddlewareResult> => {
    const enabled = await ensureFeatureEnabled(interaction, flag);
    return { status: enabled ? ProcessExitCode.OK : ProcessExitCode.UNAVAILABLE };
  }) as MiddlewareFunction<T>;
