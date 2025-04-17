import { AttachmentBuilder } from 'discord.js';

export default Object.freeze({
  wattson: { '256x256': { file: new AttachmentBuilder('assets/wattson-256x256.png'), url: 'attachment://wattson-256x256.png' } },
  volt: {
    '256x256': {
      file: new AttachmentBuilder('assets/volt-logo-purple-256x256.png'),
      url: 'attachment://volt-logo-purple-256x256.png',
    },
  },
});
