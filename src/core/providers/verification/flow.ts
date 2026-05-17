import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  DMChannel,
  EmbedBuilder,
  Message,
  MessageFlags,
  StringSelectMenuBuilder,
  User,
} from 'discord.js';
import { createChoiceMenu } from './actions';

export type PromptRenderer = () => { title: string; description?: string };

export type ChoiceOption = { label: string; value: string; category?: string; description?: string };
export type CategorizedChoiceOption = ChoiceOption & { category: string };

export type TextStep = {
  kind: 'text';
  key: string;
  prompt: PromptRenderer;
  validate?: (input: string) => true | string;
  when?: (answers: FlowAnswers) => boolean;
};
export type ChoiceStep = {
  kind: 'choice';
  key: string;
  prompt: PromptRenderer;
  min?: number;
  max?: number;
  multi?: boolean;
  when?: (answers: FlowAnswers) => boolean;
};
export type ConfirmStep = { kind: 'confirm'; key: string; prompt: PromptRenderer; when?: (answers: FlowAnswers) => boolean };
export type PaginatedConfirmStep = {
  kind: 'paginated-confirm';
  key: string;
  prompt: PromptRenderer;
  pages: EmbedBuilder[];
  when?: (answers: FlowAnswers) => boolean;
};

export type Step =
  | TextStep
  | (ChoiceStep & { categorization?: false; options: ChoiceOption[] })
  | (ChoiceStep & { categorization: true; options: CategorizedChoiceOption[] })
  | ConfirmStep
  | PaginatedConfirmStep;

export type FlowAnswer = string | string[];
export type FlowAnswers = Record<string, FlowAnswer>;

export interface FlowRunOptions {
  color: `#${string}`;
  onStepStart?: (step: Step, index: number, total: number) => void;
}

export class Flow {
  private steps: Step[] = [];

  step(step: Step): this {
    this.steps.push(step);
    return this;
  }

  build(): FlowRunner {
    return new FlowRunner([...this.steps]);
  }
}

export class FlowCancelled extends Error {
  constructor(
    public readonly step: Step,
    public readonly reason: 'timeout' | 'invalid' | 'aborted'
  ) {
    super(`Flow cancelled at step ${step.key}: ${reason}`);
  }
}

export class FlowRunner {
  constructor(private readonly steps: Step[]) {}

  async run(user: User, channel: DMChannel, opts: FlowRunOptions): Promise<FlowAnswers> {
    const answers: FlowAnswers = {};
    let displayIndex = 0;

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      if (step.when && !step.when(answers)) continue;

      opts.onStepStart?.(step, displayIndex, this.steps.length);

      if (step.kind === 'text') {
        answers[step.key] = await this.runTextStep(user, channel, step, opts.color, displayIndex, this.steps.length);
      } else if (step.kind === 'choice') {
        answers[step.key] = await this.runChoiceStep(user, channel, step, opts.color, displayIndex, this.steps.length);
      } else if (step.kind === 'confirm') {
        answers[step.key] = await this.runConfirmStep(user, channel, step, opts.color, displayIndex, this.steps.length);
      } else if (step.kind === 'paginated-confirm') {
        answers[step.key] = await this.runPaginatedConfirmStep(user, channel, step, opts.color, displayIndex, this.steps.length);
      }
      displayIndex++;
    }

    return answers;
  }

  private embed(step: Step, color: `#${string}`, index: number, total: number) {
    const { title, description } = step.prompt();
    const e = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setFooter({ text: `Step ${index + 1} of ${total}` });
    if (description) e.setDescription(description);
    return e;
  }

  private async runTextStep(
    user: User,
    channel: DMChannel,
    step: Extract<Step, { kind: 'text' }>,
    color: `#${string}`,
    index: number,
    total: number
  ): Promise<string> {
    await channel.send({ embeds: [this.embed(step, color, index, total)] });

    while (true) {
      const c = await channel.awaitMessages({ filter: (m) => m.author.id === user.id, max: 1 });
      const collected = c.first() as Message<false> | undefined;

      if (!collected) throw new FlowCancelled(step, 'aborted');

      const content = collected.content.trim();
      const validation = step.validate?.(content);
      if (validation && validation !== true) {
        await channel.send(`❌ ${validation}`);
        continue;
      }
      return content;
    }
  }

  private chunkOptions<T>(options: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < options.length; i += size) {
      chunks.push(options.slice(i, i + size));
    }
    return chunks;
  }

  private formatCategory(cat: string): string {
    return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private async runChoiceStep(
    user: User,
    channel: DMChannel,
    step: Extract<Step, { kind: 'choice' }>,
    color: `#${string}`,
    index: number,
    total: number
  ): Promise<string | string[]> {
    const MENU_MAX = 25;
    const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];
    let menuIndex = 0;

    if (step.categorization) {
      const grouped = step.options.reduce(
        (accumulator, opt) => {
          if (!accumulator[opt.category]) {
            accumulator[opt.category] = [];
          }
          accumulator[opt.category].push(opt);
          return accumulator;
        },
        {} as Record<string, typeof step.options>
      );

      for (const [category, opts] of Object.entries(grouped)) {
        const chunks = this.chunkOptions(opts, MENU_MAX);
        const label = this.formatCategory(category);
        chunks.forEach((chunk, ci) => {
          const placeholder = chunks.length > 1 ? `${label} (${ci + 1}/${chunks.length})` : label;
          components.push(createChoiceMenu(step, chunk, menuIndex++, placeholder));
        });
      }
    } else {
      this.chunkOptions(step.options, MENU_MAX).forEach((chunk, i) => {
        const placeholder = step.options.length > MENU_MAX ? `Select… (${i + 1})` : undefined;
        components.push(createChoiceMenu(step, chunk, menuIndex++, placeholder));
      });
    }

    const confirmId = `flow:${step.key}:confirm`;
    const confirmButton = new ButtonBuilder().setCustomId(confirmId).setLabel('Confirm Selection').setStyle(ButtonStyle.Success);
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton));

    const message = await channel.send({ embeds: [this.embed(step, color, index, total)], components });

    const selections = new Map<string, string[]>();
    const baseCustomId = `flow:${step.key}`;

    while (true) {
      let interaction;
      try {
        interaction = await message.awaitMessageComponent({ filter: (i) => i.user.id === user.id && i.customId.startsWith(baseCustomId) });
      } catch {
        throw new FlowCancelled(step, 'aborted');
      }

      if (interaction.isStringSelectMenu()) {
        selections.set(interaction.customId, interaction.values);
        await interaction.deferUpdate();
      } else if (interaction.isButton() && interaction.customId === confirmId) {
        const currentSelections = Array.from(selections.values()).flat();

        if (currentSelections.length < (step.min ?? 0)) {
          await interaction.reply({
            content: `⚠️ You need to select at least ${step.min ?? 'one'} item before confirming!`,
            flags: MessageFlags.Ephemeral,
          });
          continue;
        }

        await interaction.update({ components: [] });
        break;
      }
    }

    const allSelected = Array.from(selections.values()).flat();
    const finalSelection = step.multi ? allSelected : allSelected[0];
    const optionMap = new Map(step.options.map((o) => [o.value, o.label]));
    const labels = allSelected.map((v) => optionMap.get(v) ?? v);
    await channel.send({ embeds: [new EmbedBuilder().setColor(color).setDescription(`✅ **Selected:** ${labels.join(', ')}`)] });
    return finalSelection;
  }

  private async runConfirmStep(
    user: User,
    channel: DMChannel,
    step: Extract<Step, { kind: 'confirm' }>,
    color: `#${string}`,
    index: number,
    total: number
  ): Promise<string> {
    const customId = `flow:${step.key}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${customId}:yes`).setLabel('I agree').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${customId}:no`).setLabel('I disagree').setStyle(ButtonStyle.Danger)
    );

    const message = await channel.send({ embeds: [this.embed(step, color, index, total)], components: [row] });

    const interaction = await message.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === user.id && i.customId.startsWith(customId),
    });
    await interaction.update({ components: [] });
    const choice = interaction.customId.endsWith(':yes') ? 'yes' : 'no';
    if (choice === 'no') throw new FlowCancelled(step, 'aborted');
    await channel.send(`> ✅ **Agreed.**`);
    return 'yes';
  }

  private async runPaginatedConfirmStep(
    user: User,
    channel: DMChannel,
    step: Extract<Step, { kind: 'paginated-confirm' }>,
    color: `#${string}`,
    index: number,
    total: number
  ): Promise<string> {
    const baseId = `flow:${step.key}`;
    const pages = step.pages;

    if (pages.length === 0) {
      return this.runConfirmStep(user, channel, { kind: 'confirm', key: step.key, prompt: step.prompt }, color, index, total);
    }

    let currentPage = 0;

    const buildComponents = () => {
      const isLast = currentPage === pages.length - 1;
      const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${baseId}:prev`)
          .setLabel('⏮ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId(`${baseId}:next`).setLabel('Next ⏭').setStyle(ButtonStyle.Secondary).setDisabled(isLast)
      );
      if (!isLast) return [navRow];
      const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${baseId}:yes`).setLabel('✅ I agree').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${baseId}:no`).setLabel('❌ I disagree').setStyle(ButtonStyle.Danger)
      );
      return [navRow, confirmRow];
    };

    const { title, description } = step.prompt();
    const preamble = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setFooter({ text: `Step ${index + 1} of ${total}` });
    if (description) preamble.setDescription(description);
    await channel.send({ embeds: [preamble] });

    pages[0].setFooter({ text: `Rules · 1 / ${pages.length}` });
    const message = await channel.send({ embeds: [pages[0]], components: buildComponents() });

    return new Promise<string>((resolve, reject) => {
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === user.id && i.customId.startsWith(baseId),
      });

      collector.on('collect', async (interaction) => {
        if (interaction.customId === `${baseId}:prev` && currentPage > 0) {
          currentPage--;
          pages[currentPage].setFooter({ text: `Rules · ${currentPage + 1} / ${pages.length}` });
          await interaction.update({ embeds: [pages[currentPage]], components: buildComponents() });
        } else if (interaction.customId === `${baseId}:next` && currentPage < pages.length - 1) {
          currentPage++;
          pages[currentPage].setFooter({ text: `Rules · ${currentPage + 1} / ${pages.length}` });
          await interaction.update({ embeds: [pages[currentPage]], components: buildComponents() });
        } else if (interaction.customId === `${baseId}:yes`) {
          await interaction.update({ components: [] });
          collector.stop('agreed');
          channel.send(`> ✅ **You accepted the rules.**`).catch(() => null);
          resolve('yes');
        } else if (interaction.customId === `${baseId}:no`) {
          await interaction.update({ components: [] });
          collector.stop('disagreed');
          reject(new FlowCancelled(step, 'aborted'));
        } else {
          await interaction.deferUpdate();
        }
      });

      collector.on('end', (_collected, reason) => {
        if (reason !== 'agreed' && reason !== 'disagreed') {
          reject(new FlowCancelled(step, 'timeout'));
        }
      });
    });
  }
}
