import type { BaseTranslation } from '../i18n-types.js';

const en = {
  SYSTEM: {
    STATUS: {
      STATE: 'Startup Status',
      SERVICE_LATENCY: 'Service Latency',
      SERVICE_LAUNCH_TIME: 'Launch Time',
      SERVICE_UPTIME: 'Service Uptime',
      API_LATENCY: 'API Latency',
      DATABASE: 'Database Connection',
      SHARDS: 'Shard Count',
      LOADED_COMMANDS: 'Loaded Commands',
    },
    EVENT_READY: {
      EMBED_TITLE: 'Wattson - Always at your service',
      EMBED_DESCRIPTION: 'The honorable detective Watson is now online and ready to serve.',
    },
  },
  GENERAL: { WATTSON_IN_SERVICE: 'Wattson, in service for Europe' },
  UTIL: {
    COMMAND_PING: {
      EMBED_TITLE: 'Wattson - Constable Pong',
      EMBED_DESCRIPTION: 'Ah! A signal most curious — I daresay, the latency is but a fleeting whisper..',
    },
  },
} satisfies BaseTranslation;

export default en;
