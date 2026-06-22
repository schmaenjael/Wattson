import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { Cron } from 'croner';

import { Command, Permission } from '~/core/models';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import {
  getSettings,
  createEvent,
  findEventById,
  updateEvent,
  cancelEvent,
  listUpcomingEvents,
  listEventsByCreator,
  listRegistrationsForEvent,
  countRegistrationsForEvent,
  registerForEvent,
  unregisterFromEvent,
  isRegistered,
  deleteRegistrationsForEvent,
} from '~/database';
import { L } from '~/core/locales';
import { attempt } from '~/utilities';

const TIMEZONE_CHOICES = [
  { name: 'UTC', value: 'UTC' },
  { name: 'London (GMT/BST)', value: 'Europe/London' },
  { name: 'Lisbon (WET/WEST)', value: 'Europe/Lisbon' },
  { name: 'Paris / Berlin (CET/CEST)', value: 'Europe/Paris' },
  { name: 'Amsterdam / Brussels', value: 'Europe/Amsterdam' },
  { name: 'Madrid / Rome', value: 'Europe/Madrid' },
  { name: 'Vienna / Prague', value: 'Europe/Vienna' },
  { name: 'Warsaw / Budapest', value: 'Europe/Warsaw' },
  { name: 'Athens / Helsinki (EET/EEST)', value: 'Europe/Athens' },
  { name: 'Kyiv', value: 'Europe/Kyiv' },
  { name: 'New York (EST/EDT)', value: 'America/New_York' },
] satisfies { name: string; value: string }[];

const toUtc = (dateStr: string, timeStr: string, tz: string): Date => {
  const local = new Date(`${dateStr}T${timeStr}:00`);
  const inTz = new Date(local.toLocaleString('en-US', { timeZone: tz }));
  return new Date(local.getTime() + (local.getTime() - inTz.getTime()));
};

const ts = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:F>`;

const isEventManager = (memberRoleIds: Set<string>, roleEventManagerId: string | null): boolean =>
  roleEventManagerId !== null && memberRoleIds.has(roleEventManagerId);

const canManageEvent = (
  creatorId: string | null,
  userId: string,
  memberRoleIds: Set<string>,
  settings: { roleEventManagerId: string | null; roleModerationId: string | null }
): boolean => {
  if (creatorId === userId) return true;
  if (settings.roleModerationId && memberRoleIds.has(settings.roleModerationId)) return true;
  if (settings.roleEventManagerId && memberRoleIds.has(settings.roleEventManagerId)) return true;
  return false;
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Events,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Community],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Manage and browse server events.')
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Create a new event.')
        .addStringOption((o) => o.setName('name').setDescription('Event name').setRequired(true).setMaxLength(128))
        .addStringOption((o) => o.setName('description').setDescription('Event description').setRequired(true).setMaxLength(2048))
        .addStringOption((o) => o.setName('date').setDescription('Date in YYYY-MM-DD format').setRequired(true).setMaxLength(10))
        .addStringOption((o) => o.setName('time').setDescription('Time in HH:MM format (24h)').setRequired(true).setMaxLength(5))
        .addStringOption((o) =>
          o
            .setName('timezone')
            .setDescription('Timezone for the date/time')
            .setRequired(true)
            .addChoices(...TIMEZONE_CHOICES)
        )
        .addChannelOption((o) => o.setName('text-channel').setDescription('Associated text channel (optional)').setRequired(false))
        .addChannelOption((o) => o.setName('voice-channel').setDescription('Associated voice channel (optional)').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('recreate')
        .setDescription('Recreate an existing event, optionally overriding fields.')
        .addIntegerOption((o) => o.setName('event-id').setDescription('ID of the event to recreate').setRequired(true).setMinValue(1))
        .addStringOption((o) => o.setName('name').setDescription('Override name').setRequired(false).setMaxLength(128))
        .addStringOption((o) => o.setName('description').setDescription('Override description').setRequired(false).setMaxLength(2048))
        .addStringOption((o) => o.setName('date').setDescription('Override date (YYYY-MM-DD)').setRequired(false).setMaxLength(10))
        .addStringOption((o) => o.setName('time').setDescription('Override time (HH:MM, 24h)').setRequired(false).setMaxLength(5))
        .addStringOption((o) =>
          o
            .setName('timezone')
            .setDescription('Timezone for overridden date/time')
            .setRequired(false)
            .addChoices(...TIMEZONE_CHOICES)
        )
        .addChannelOption((o) => o.setName('text-channel').setDescription('Override text channel').setRequired(false))
        .addChannelOption((o) => o.setName('voice-channel').setDescription('Override voice channel').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('repeat')
        .setDescription('Set or clear a recurring cron schedule for an event.')
        .addIntegerOption((o) => o.setName('event-id').setDescription('Event ID').setRequired(true).setMinValue(1))
        .addStringOption((o) =>
          o
            .setName('cron')
            .setDescription('Cron expression (e.g. "0 18 * * 5" = every Friday 18:00 UTC) or "clear" to remove')
            .setRequired(true)
            .setMaxLength(128)
        )
    )
    .addSubcommand((s) => s.setName('dashboard').setDescription('List your own events (upcoming and last 30 days).'))
    .addSubcommand((s) => s.setName('list').setDescription('Browse all upcoming server events and sign up.'))
    .addSubcommand((s) =>
      s
        .setName('register')
        .setDescription('Register for an event by ID.')
        .addIntegerOption((o) => o.setName('event-id').setDescription('Event ID').setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s
        .setName('unregister')
        .setDescription('Remove your registration from an event.')
        .addIntegerOption((o) => o.setName('event-id').setDescription('Event ID').setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s
        .setName('cancel')
        .setDescription('Cancel an event and notify all registrants.')
        .addIntegerOption((o) => o.setName('event-id').setDescription('Event ID').setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s
        .setName('attendees')
        .setDescription('List registered attendees for an event.')
        .addIntegerOption((o) => o.setName('event-id').setDescription('Event ID').setRequired(true).setMinValue(1))
    ),

  async executeCommand(_command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const sub = interaction.options.getSubcommand(true);
    const locale = interaction.locale;
    const color = appFeatureMap[AppFeature.Events].color;
    const settings = await getSettings();
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    const memberRoleIds = new Set(member?.roles.cache.keys() ?? []);

    if (sub === 'create' || sub === 'recreate' || sub === 'repeat' || sub === 'dashboard' || sub === 'cancel' || sub === 'attendees') {
      if (
        !isEventManager(memberRoleIds, settings.roleEventManagerId) &&
        !memberRoleIds.has(settings.roleModerationId ?? '') &&
        !memberRoleIds.has(settings.roleAdministrationId ?? '')
      ) {
        await interaction.reply({ content: L[locale].GENERAL.COMMAND_INVALID_PERMISSIONS(), flags: MessageFlags.Ephemeral });
        return;
      }
    }

    if (sub === 'create') {
      const name = interaction.options.getString('name', true);
      const description = interaction.options.getString('description', true);
      const dateStr = interaction.options.getString('date', true);
      const timeStr = interaction.options.getString('time', true);
      const tz = interaction.options.getString('timezone', true);
      const textChannel = interaction.options.getChannel('text-channel', false);
      const voiceChannel = interaction.options.getChannel('voice-channel', false);

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!dateRegex.test(dateStr) || !timeRegex.test(timeStr)) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_CREATE.ERROR_INVALID_DATE(), flags: MessageFlags.Ephemeral });
        return;
      }

      let scheduledAt: Date;
      try {
        scheduledAt = toUtc(dateStr, timeStr, tz);
        if (isNaN(scheduledAt.getTime())) throw new Error('invalid date');
      } catch {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_CREATE.ERROR_INVALID_DATE(), flags: MessageFlags.Ephemeral });
        return;
      }

      if (scheduledAt <= new Date()) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_CREATE.ERROR_PAST_DATE(), flags: MessageFlags.Ephemeral });
        return;
      }

      const event = await createEvent({
        creatorId: interaction.user.id,
        name,
        description,
        scheduledAt,
        textChannelId: textChannel?.id,
        voiceChannelId: voiceChannel?.id,
      });

      await interaction.reply({
        content: L[locale].EVENT.COMMAND_CREATE.SUCCESS({ name: event.name, id: event.id, time: ts(event.scheduledAt) }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'recreate') {
      const eventId = interaction.options.getInteger('event-id', true);
      const original = await findEventById(eventId);

      if (!original) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_RECREATE.ERROR_NOT_FOUND({ id: eventId }), flags: MessageFlags.Ephemeral });
        return;
      }

      if (!canManageEvent(original.creatorId, interaction.user.id, memberRoleIds, settings)) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_RECREATE.ERROR_NOT_OWNER(), flags: MessageFlags.Ephemeral });
        return;
      }

      const dateStr = interaction.options.getString('date', false);
      const timeStr = interaction.options.getString('time', false);
      const tz = interaction.options.getString('timezone', false);
      const textChannel = interaction.options.getChannel('text-channel', false);
      const voiceChannel = interaction.options.getChannel('voice-channel', false);

      let scheduledAt = original.scheduledAt;
      if (dateStr || timeStr) {
        const resolvedDate = dateStr ?? original.scheduledAt.toISOString().slice(0, 10);
        const resolvedTime =
          timeStr ??
          `${String(original.scheduledAt.getUTCHours()).padStart(2, '0')}:${String(original.scheduledAt.getUTCMinutes()).padStart(2, '0')}`;
        const resolvedTz = tz ?? 'UTC';
        try {
          scheduledAt = toUtc(resolvedDate, resolvedTime, resolvedTz);
          if (isNaN(scheduledAt.getTime())) throw new Error('invalid');
        } catch {
          await interaction.reply({ content: L[locale].EVENT.COMMAND_CREATE.ERROR_INVALID_DATE(), flags: MessageFlags.Ephemeral });
          return;
        }
      }

      if (scheduledAt <= new Date()) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_CREATE.ERROR_PAST_DATE(), flags: MessageFlags.Ephemeral });
        return;
      }

      const newEvent = await createEvent({
        creatorId: interaction.user.id,
        name: interaction.options.getString('name', false) ?? original.name,
        description: interaction.options.getString('description', false) ?? original.description,
        scheduledAt,
        textChannelId: textChannel !== null ? textChannel.id : (original.textChannelId ?? undefined),
        voiceChannelId: voiceChannel !== null ? voiceChannel.id : (original.voiceChannelId ?? undefined),
      });

      await interaction.reply({
        content: L[locale].EVENT.COMMAND_RECREATE.SUCCESS({ id: newEvent.id, time: ts(newEvent.scheduledAt) }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'repeat') {
      const eventId = interaction.options.getInteger('event-id', true);
      const cronStr = interaction.options.getString('cron', true).trim();
      const event = await findEventById(eventId);

      if (!event) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_RECREATE.ERROR_NOT_FOUND({ id: eventId }), flags: MessageFlags.Ephemeral });
        return;
      }

      if (!canManageEvent(event.creatorId, interaction.user.id, memberRoleIds, settings)) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_RECREATE.ERROR_NOT_OWNER(), flags: MessageFlags.Ephemeral });
        return;
      }

      if (cronStr.toLowerCase() === 'clear') {
        await updateEvent(eventId, { cronPattern: null });
        await interaction.reply({ content: L[locale].EVENT.COMMAND_REPEAT.CLEARED({ id: eventId }), flags: MessageFlags.Ephemeral });
        return;
      }

      try {
        new Cron(cronStr);
      } catch {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_REPEAT.ERROR_INVALID_CRON(), flags: MessageFlags.Ephemeral });
        return;
      }

      await updateEvent(eventId, { cronPattern: cronStr });
      await interaction.reply({ content: L[locale].EVENT.COMMAND_REPEAT.SET({ id: eventId, cron: cronStr }), flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'dashboard') {
      const myEvents = await listEventsByCreator(interaction.user.id);

      const embed = new EmbedBuilder().setColor(color).setTitle(L[locale].EVENT.COMMAND_DASHBOARD.TITLE()).setTimestamp();

      if (myEvents.length === 0) {
        embed.setDescription(L[locale].EVENT.COMMAND_DASHBOARD.EMPTY());
      } else {
        const lines = await Promise.all(
          myEvents.map(async (e) => {
            const count = await countRegistrationsForEvent(e.id);
            const status = e.cancelledAt ? '~~' : '';
            const repeat = e.cronPattern ? ' 🔁' : '';
            return `${status}**\`${e.id}\`** ${e.name}${status}${repeat} — ${ts(e.scheduledAt)} · **${count}** registered`;
          })
        );
        embed.setDescription(lines.join('\n'));
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'list') {
      const PAGE_SIZE = 10;
      let page = 0;

      const buildPage = async (p: number) => {
        const { events, total } = await listUpcomingEvents(PAGE_SIZE, p * PAGE_SIZE);
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(L[locale].EVENT.COMMAND_LIST.TITLE())
          .setFooter({ text: `Page ${p + 1} of ${totalPages}` })
          .setTimestamp();

        if (events.length === 0) {
          embed.setDescription(L[locale].EVENT.COMMAND_LIST.EMPTY());
        } else {
          const lines = await Promise.all(
            events.map(async (e) => {
              const count = await countRegistrationsForEvent(e.id);
              const registered = await isRegistered(e.id, interaction.user.id);
              const check = registered ? '✅ ' : '';
              return `${check}**\`${e.id}\`** ${e.name} — ${ts(e.scheduledAt)} · ${count} registered`;
            })
          );
          embed.setDescription(lines.join('\n'));
        }

        const prev = new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(p === 0);
        const next = new ButtonBuilder()
          .setCustomId('next')
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled((p + 1) * PAGE_SIZE >= total);

        const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [
          new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next),
        ];

        if (events.length > 0) {
          const options = events.map((e) =>
            new StringSelectMenuOptionBuilder().setLabel(e.name.slice(0, 100)).setValue(String(e.id)).setDescription(ts(e.scheduledAt).slice(0, 100))
          );
          const menu = new StringSelectMenuBuilder()
            .setCustomId('signup')
            .setPlaceholder('Sign up for events on this page...')
            .setMinValues(1)
            .setMaxValues(events.length)
            .addOptions(...options);
          components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
        }

        return { embed, components, total };
      };

      const { embed, components } = await buildPage(page);
      const reply = await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral, fetchReply: true });

      const collector = reply.createMessageComponentCollector({ time: 60_000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: 'Not yours.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (i.componentType === ComponentType.Button) {
          if (i.customId === 'prev') page = Math.max(0, page - 1);
          if (i.customId === 'next') page += 1;
          const { embed: newEmbed, components: newComponents } = await buildPage(page);
          await i.update({ embeds: [newEmbed], components: newComponents });
          return;
        }

        if (i.componentType === ComponentType.StringSelect && i.customId === 'signup') {
          const ids = i.values.map(Number);
          let signedUp = 0;
          for (const id of ids) {
            const ev = await findEventById(id);
            if (!ev || ev.cancelledAt || ev.scheduledAt <= new Date()) continue;
            const alreadyIn = await isRegistered(id, i.user.id);
            if (!alreadyIn) {
              await registerForEvent(id, i.user.id);
              signedUp++;
            }
          }
          const { embed: newEmbed, components: newComponents } = await buildPage(page);
          await i.update({ content: L[locale].EVENT.COMMAND_LIST.SIGNED_UP({ count: signedUp }), embeds: [newEmbed], components: newComponents });
          return;
        }
      });

      collector.on('end', async () => {
        await attempt(() => interaction.editReply({ components: [] }));
      });

      return;
    }

    if (sub === 'register') {
      const eventId = interaction.options.getInteger('event-id', true);
      const event = await findEventById(eventId);

      if (!event) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_REGISTER.ERROR_NOT_FOUND({ id: eventId }), flags: MessageFlags.Ephemeral });
        return;
      }

      if (event.cancelledAt || event.scheduledAt <= new Date()) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_REGISTER.ERROR_PAST_OR_CANCELLED(), flags: MessageFlags.Ephemeral });
        return;
      }

      const alreadyIn = await isRegistered(eventId, interaction.user.id);
      if (alreadyIn) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_REGISTER.ALREADY_REGISTERED(), flags: MessageFlags.Ephemeral });
        return;
      }

      await registerForEvent(eventId, interaction.user.id);
      await interaction.reply({
        content: L[locale].EVENT.COMMAND_REGISTER.SUCCESS({ name: event.name, time: ts(event.scheduledAt) }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'unregister') {
      const eventId = interaction.options.getInteger('event-id', true);
      const event = await findEventById(eventId);

      if (!event) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_UNREGISTER.ERROR_NOT_FOUND({ id: eventId }), flags: MessageFlags.Ephemeral });
        return;
      }

      const wasIn = await unregisterFromEvent(eventId, interaction.user.id);
      if (!wasIn) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_UNREGISTER.NOT_REGISTERED(), flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply({ content: L[locale].EVENT.COMMAND_UNREGISTER.SUCCESS({ name: event.name }), flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'cancel') {
      const eventId = interaction.options.getInteger('event-id', true);
      const event = await findEventById(eventId);

      if (!event) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_CANCEL.ERROR_NOT_FOUND({ id: eventId }), flags: MessageFlags.Ephemeral });
        return;
      }

      if (!canManageEvent(event.creatorId, interaction.user.id, memberRoleIds, settings)) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_CANCEL.ERROR_NOT_OWNER(), flags: MessageFlags.Ephemeral });
        return;
      }

      const registrations = await listRegistrationsForEvent(eventId);
      await cancelEvent(eventId);
      await deleteRegistrationsForEvent(eventId);

      let notified = 0;
      for (const reg of registrations) {
        const sent = await attempt(async () => {
          const user = await client.users.fetch(reg.userId);
          return user.send(L[locale].EVENT.COMMAND_CANCEL.DM_NOTIFY({ name: event.name, time: ts(event.scheduledAt) }));
        });
        if (sent !== null) notified++;
      }

      await interaction.reply({ content: L[locale].EVENT.COMMAND_CANCEL.SUCCESS({ id: eventId, count: notified }), flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'attendees') {
      const eventId = interaction.options.getInteger('event-id', true);
      const event = await findEventById(eventId);

      if (!event) {
        await interaction.reply({ content: L[locale].EVENT.COMMAND_RECREATE.ERROR_NOT_FOUND({ id: eventId }), flags: MessageFlags.Ephemeral });
        return;
      }

      const registrations = await listRegistrationsForEvent(eventId);
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(L[locale].EVENT.COMMAND_ATTENDEES.TITLE({ name: event.name }))
        .setTimestamp();

      if (registrations.length === 0) {
        embed.setDescription(L[locale].EVENT.COMMAND_ATTENDEES.EMPTY());
      } else {
        embed.setDescription(registrations.map((r) => `<@${r.userId}> — registered ${ts(r.registeredAt)}`).join('\n'));
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }
  },
});
