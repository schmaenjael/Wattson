import { ButtonInteraction, EmbedBuilder, MessageFlags } from 'discord.js';

import { BotException, Client } from '~/core/models';
import { AppFeature, Colors } from '~/settings';
import { AuditEventType, executeGdprDeletion, recordAuditEvent, upsertUser } from '~/database';
import { L, baseLocale } from '~/core/locales';
import { attempt } from '~/utilities';

type ButtonHandler = (client: Client, interaction: ButtonInteraction) => Promise<void>;

const DM = L[baseLocale].MODERATION.GDPR_REQUEST;

const handleApprove = async (client: Client, interaction: ButtonInteraction, targetId: string, requesterId: string): Promise<void> => {
  await upsertUser({ id: interaction.user.id, username: interaction.user.username });

  try {
    await executeGdprDeletion(targetId, interaction.user.id);
  } catch (error) {
    throw new BotException(client, `GDPR deletion transaction failed for user ${targetId}`, error);
  }

  await attempt(
    () => interaction.guild!.bans.create(targetId, { reason: `[GDPR] Data Deletion Request — approved by ${interaction.user.username}` }),
    { feature: AppFeature.GdprDeletion, errorCode: 'DATA_DELETION_BAN_CREATE', context: { targetId } }
  );

  await attempt(
    async () => {
      const dmChannel = await client.users.createDM(targetId);
      await dmChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(DM.DM_EXECUTED_TITLE())
            .setDescription(DM.DM_EXECUTED_DESCRIPTION())
            .addFields(
              { name: DM.DM_DELETED_TITLE(), value: DM.DM_DELETED_VALUE() },
              { name: DM.DM_NOT_DELETED_TITLE(), value: DM.DM_NOT_DELETED_VALUE() },
              { name: '​', value: DM.DM_BAN_NOTICE() }
            )
            .setTimestamp(),
        ],
      });
    },
    { feature: AppFeature.GdprDeletion, errorCode: 'DATA_DELETION_EXECUTED_DM_SEND', context: { targetId } }
  );

  await recordAuditEvent({
    eventType: AuditEventType.DataDeletionExecuted,
    actorUserId: interaction.user.id,
    targetUserId: targetId,
    payload: { approvedBy: interaction.user.id, requestedBy: requesterId },
  });

  await interaction.message.edit({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('GDPR/DSGVO Data Deletion — Executed')
        .addFields(
          { name: 'Target', value: `\`${targetId}\``, inline: true },
          { name: 'Approved by', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Status', value: '✅ All data erased. User permanently banned.' }
        )
        .setTimestamp(),
    ],
    components: [],
  });
};

const handleDeny = async (client: Client, interaction: ButtonInteraction, targetId: string, requesterId: string): Promise<void> => {
  await attempt(
    async () => {
      const dmChannel = await client.users.createDM(targetId);
      await dmChannel.send({
        embeds: [new EmbedBuilder().setColor(Colors.White).setTitle(DM.DM_DENIED_TITLE()).setDescription(DM.DM_DENIED_DESCRIPTION()).setTimestamp()],
      });
    },
    { feature: AppFeature.GdprDeletion, errorCode: 'DATA_DELETION_DENIED_DM_SEND', context: { targetId } }
  );

  await recordAuditEvent({
    eventType: AuditEventType.DataDeletionDenied,
    actorUserId: interaction.user.id,
    targetUserId: targetId,
    payload: { deniedBy: interaction.user.id, requestedBy: requesterId },
  });

  await interaction.message.edit({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.White)
        .setTitle('GDPR/DSGVO Data Deletion Request — Denied')
        .addFields(
          { name: 'Target', value: `<@${targetId}> (\`${targetId}\`)`, inline: true },
          { name: 'Denied by', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Status', value: '❌ Request denied. No data was modified.' }
        )
        .setTimestamp(),
    ],
    components: [],
  });
};

const ACTIONS: Record<string, (client: Client, interaction: ButtonInteraction, targetId: string, requesterId: string) => Promise<void>> = {
  approve: handleApprove,
  deny: handleDeny,
};

export const handleGdprButton: ButtonHandler = async (client, interaction) => {
  const [, action, targetId, requesterId] = interaction.customId.split(':');
  if (!action || !targetId || !requesterId || !ACTIONS[action]) return;

  if (interaction.message.components.length === 0) {
    await interaction.reply({ content: 'This request has already been handled.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();
  await ACTIONS[action](client, interaction, targetId, requesterId);
};
