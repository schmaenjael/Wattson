import { AttachmentBuilder, EmbedBuilder, HexColorString, Locale, MessageFlags } from 'discord.js';

interface ComponentRequirements {
  color: HexColorString;
  locale: Locale;
}

export abstract class Component<TRequired = unknown, TOptional = unknown> {
  public readonly attachments: AttachmentBuilder[] = [];
  public readonly flags?: MessageFlags;

  constructor(
    protected readonly required: TRequired & ComponentRequirements,
    protected readonly optional?: Partial<TOptional>
  ) {}

  public abstract render(): EmbedBuilder;
}
