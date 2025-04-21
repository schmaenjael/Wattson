import { AttachmentBuilder, HexColorString } from 'discord.js';

type ColorRecord = Record<string, HexColorString>;

/** Volt Euroapa visual identy @see https://volteuropa.org/visual_identity */
const VoltColors = { Purple: '#502379', Yellow: '#FDC220', Blue: '#82D0F4', Green: '#1BBE6F', Red: '#E63E12' } as const satisfies ColorRecord;
const BotColors = { Orange: '#C76611', White: '#FFFFFF', UnionBlue: '#003399' } as const satisfies ColorRecord;

export const Colors: ColorRecord = { ...BotColors, ...VoltColors };

/** Volt Euroapa logo and Wattson icon */
export const assets = Object.freeze({
  wattson: { '256x256': { file: new AttachmentBuilder('assets/wattson-256x256.png'), url: 'attachment://wattson-256x256.png' } },
  volt: { '256x256': { file: new AttachmentBuilder('assets/volt-logo-purple-256x256.png'), url: 'attachment://volt-logo-purple-256x256.png' } },
});
