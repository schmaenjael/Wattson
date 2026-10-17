import { Colors, EmbedBuilder, TextChannel } from 'discord.js';

import type { Client } from '~/core/models';
import type { Modmail } from '~/database';
import { AppFeature } from '~/settings';
import { softFail } from '~/utilities';

export enum CloseActionType {
  VerificationFollowUp = 'verification_followup',
}

export interface VerificationFollowUpPayload {
  memberId: string;
  channelId: string;
  messageId: string;
}

type CloseActionHandler = (client: Client, modmail: Modmail, payload: unknown) => Promise<void>;

async function handleVerificationFollowUp(client: Client, modmail: Modmail, payload: unknown): Promise<void> {
  const { memberId, channelId, messageId } = payload as VerificationFollowUpPayload;

  const rawChannel = await client.channels.fetch(channelId).catch(softFail(AppFeature.Modmail, 'MODMAIL_CHANNEL_FETCH', { channelId }));
  if (!(rawChannel instanceof TextChannel)) return;

  const approvalMessage = await rawChannel.messages.fetch(messageId).catch(softFail(AppFeature.Modmail, 'MODMAIL_MESSAGE_FETCH', { messageId }));

  await rawChannel
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle('📬 Verification Follow-up Concluded')
          .setDescription(
            `The follow-up conversation with <@${memberId}> (Modmail #${modmail.id}) has closed.\n` +
              `Review the thread <#${modmail.threadId}> and make your decision on the original verification request.`
          )
          .addFields(...(approvalMessage ? [{ name: 'Original Request', value: `[Jump to approval](${approvalMessage.url})`, inline: false }] : []))
          .setTimestamp(),
      ],
    })
    .catch(softFail(AppFeature.Modmail, 'MODMAIL_CHANNEL_SEND'));
}

const ACTION_HANDLERS: Record<string, CloseActionHandler> = { [CloseActionType.VerificationFollowUp]: handleVerificationFollowUp };

export const dispatchCloseAction = async (client: Client, modmail: Modmail): Promise<void> => {
  if (!modmail.closeAction?.type) return;
  const handler = ACTION_HANDLERS[modmail.closeAction.type];
  if (!handler) return;
  await handler(client, modmail, modmail.closeAction.payload ?? {}).catch(softFail(AppFeature.Modmail, 'MODMAIL_CLOSE_ACTION', { client }));
};
