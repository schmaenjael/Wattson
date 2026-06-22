import {
  ActionRowBuilder,
  AttachmentBuilder,
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
import { createCanvas } from 'canvas';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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
export type CaptchaStep = { kind: 'captcha'; key: string; prompt: PromptRenderer; maxAttempts?: number; when?: (answers: FlowAnswers) => boolean };

export type Step =
  | TextStep
  | (ChoiceStep & { categorization?: false; options: ChoiceOption[] })
  | (ChoiceStep & { categorization: true; options: CategorizedChoiceOption[] })
  | ConfirmStep
  | PaginatedConfirmStep
  | CaptchaStep;

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
      } else if (step.kind === 'captcha') {
        answers[step.key] = await this.runCaptchaStep(user, channel, step, opts.color, displayIndex, this.steps.length);
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

  private generateCaptchaCode(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private renderCaptchaImage(code: string): Buffer {
    const width = 320;
    const height = 100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Dynamic Background Gradient instead of solid color
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#e0e4e8');
    gradient.addColorStop(0.5, '#f0f2f5');
    gradient.addColorStop(1, '#d8dee4');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Heavy Background Noise (Curves and Blobs)
    // Bezier curves are much harder for OCR to filter out than straight lines
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${Math.random() * 360}, 50%, 60%)`;
      ctx.lineWidth = Math.random() * 2 + 1.5;
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.bezierCurveTo(
        Math.random() * width,
        Math.random() * height,
        Math.random() * width,
        Math.random() * height,
        Math.random() * width,
        Math.random() * height
      );
      ctx.stroke();
    }

    // Random scattering of noise blocks
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `hsl(${Math.random() * 360}, 40%, 60%)`;
      ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 4 + 1, Math.random() * 4 + 1);
    }

    // 3. Render Text with Tracking, Scaling, and Rotation Per Character
    const charSlot = width / (code.length + 0.5);

    for (let i = 0; i < code.length; i++) {
      ctx.save();

      // Slight random offset to break the rigid grid alignment
      const xOffset = (Math.random() - 0.5) * 10;
      const yOffset = (Math.random() - 0.5) * 12;

      ctx.translate(charSlot * (i + 0.5) + charSlot / 2 + xOffset, height / 2 + 14 + yOffset);

      // Increased maximum rotation angle (~35 degrees max)
      ctx.rotate((Math.random() - 0.5) * 0.85);

      // Randomize font style and slight scale distortions per character
      const fontSizes = ['32px', '42px', '46px', '50px'];
      const fontStyles = ['bold', 'italic bold', '900'];
      ctx.font = `${fontStyles[Math.floor(Math.random() * fontStyles.length)]} ${fontSizes[Math.floor(Math.random() * fontSizes.length)]} sans-serif`;

      // Random scale distortion (stretching/squeezing)
      ctx.scale(Math.random() * 0.5 + 0.9, Math.random() * 0.2 + 0.9);

      ctx.fillStyle = `hsl(${Math.random() * 360}, 75%, 20%)`;
      ctx.fillText(code[i]!, 0, 0);
      ctx.restore();
    }

    // 4. Foreground Distortion Strike-through Lines
    // Drawing lines over the characters forces OCR segmentation to fail
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${Math.random() * 360}, 60%, 35%)`;
      ctx.lineWidth = Math.random() * 3 + 1;
      ctx.moveTo(0, Math.random() * height);
      ctx.lineTo(width, Math.random() * height);
      ctx.stroke();
    }

    return canvas.toBuffer('image/png');
  }

  private parseWavData(buffer: Buffer): { fmt: Buffer; pcm: Buffer } {
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Not a valid WAV file');
    }
    let offset = 12;
    let fmt: Buffer | null = null;
    let pcm: Buffer | null = null;
    while (offset < buffer.length - 8) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      if (chunkId === 'fmt ') {
        fmt = buffer.subarray(offset + 8, offset + 8 + chunkSize);
      } else if (chunkId === 'data') {
        pcm = buffer.subarray(offset + 8, offset + 8 + chunkSize);
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    if (!fmt || !pcm) throw new Error('Missing fmt or data chunk in WAV');
    return { fmt, pcm };
  }

  private buildWav(fmt: Buffer, pcmChunks: Buffer[]): Buffer {
    const pcm = Buffer.concat(pcmChunks);
    const fmtChunk = Buffer.alloc(8 + fmt.length);
    fmtChunk.write('fmt ', 0);
    fmtChunk.writeUInt32LE(fmt.length, 4);
    fmt.copy(fmtChunk, 8);
    const dataChunk = Buffer.alloc(8 + pcm.length);
    dataChunk.write('data', 0);
    dataChunk.writeUInt32LE(pcm.length, 4);
    pcm.copy(dataChunk, 8);
    const riffHeader = Buffer.alloc(12);
    riffHeader.write('RIFF', 0);
    riffHeader.writeUInt32LE(4 + fmtChunk.length + dataChunk.length, 4);
    riffHeader.write('WAVE', 8);
    return Buffer.concat([riffHeader, fmtChunk, dataChunk]);
  }

  private async renderCaptchaAudio(code: string): Promise<Buffer> {
    const soundsDir = join(process.cwd(), 'config', 'sounds');
    let fmt: Buffer | null = null;
    const pcmChunks: Buffer[] = [];
    for (const char of code) {
      const raw = await readFile(join(soundsDir, `${char.toUpperCase()}.wav`));
      const parsed = this.parseWavData(raw);
      if (!fmt) fmt = parsed.fmt;
      pcmChunks.push(parsed.pcm);
    }
    if (!fmt) throw new Error('No audio data');
    return this.buildWav(fmt, pcmChunks);
  }

  private async runCaptchaStep(
    user: User,
    channel: DMChannel,
    step: Extract<Step, { kind: 'captcha' }>,
    color: `#${string}`,
    index: number,
    total: number
  ): Promise<string> {
    const maxAttempts = step.maxAttempts ?? 3;
    const code = this.generateCaptchaCode();
    const imageBuffer = this.renderCaptchaImage(code);
    const files: AttachmentBuilder[] = [new AttachmentBuilder(imageBuffer, { name: 'captcha.png' })];

    try {
      const audioBuffer = await this.renderCaptchaAudio(code);
      files.push(new AttachmentBuilder(audioBuffer, { name: 'captcha.wav' }));
    } catch (err) {
      console.error('[Captcha] Failed to render audio — falling back to image-only:', err);
    }

    await channel.send({ embeds: [this.embed(step, color, index, total)], files });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const collected = await channel.awaitMessages({ filter: (m) => m.author.id === user.id, max: 1 });
      const message = collected.first() as Message<false> | undefined;

      if (!message) throw new FlowCancelled(step, 'aborted');

      if (message.content.trim().toUpperCase() === code) {
        await channel.send(`> ✅ **Captcha passed.**`);
        return code;
      }

      if (attempt < maxAttempts) {
        await channel.send(`❌ Incorrect. ${maxAttempts - attempt} attempt(s) remaining.`);
      }
    }

    throw new FlowCancelled(step, 'invalid');
  }
}
