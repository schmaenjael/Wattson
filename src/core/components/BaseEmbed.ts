import { EmbedBuilder } from 'discord.js';

// Import Component from its module directly, not the `~/core/models` barrel: the barrel
// evaluates Client/Command/Event (which transitively load this base class) before its
// `./Component` line, so going through it leaves Component in its TDZ → "Cannot access
// 'Component' before initialization" at class-extends time.
import { Component } from '~/core/models/Component';

import { assets } from '~/settings';
import { L } from '~/core/locales';

/**
 * Shared base for every embed builder. Subclasses implement {@link render} and may
 * route their embed through {@link withBranding} to apply the standard Wattson footer
 * (volt logo + "in service" caption) and timestamp.
 */
export abstract class BaseEmbed<TRequired = unknown, TOptional = unknown> extends Component<TRequired, TOptional> {
  protected withBranding(embed: EmbedBuilder): EmbedBuilder {
    const { locale } = this.required;

    return embed.setFooter({ text: L[locale].GENERAL.WATTSON_IN_SERVICE(), iconURL: assets.volt['256x256'].url }).setTimestamp();
  }
}
