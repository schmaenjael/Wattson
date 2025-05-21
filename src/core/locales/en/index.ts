import type { BaseTranslation } from '../i18n-types.js';

const en = {
  SYSTEM: {
    ERROR: {
      EMBED_TITLE: 'An unexpected Error occured!',
      EMBED_DESCRIPTION: 'An error occurred while executing the command, this incident will be reported.',
      EMBED_RECOVERABLE: 'Automatic Recovery',
      EMBED_MESSAGE: 'Error Message',
      EMBED_STACK: 'Stacktrace',
    },
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
      EMBED_DESCRIPTION: 'The honorable detective Wattson is now online and ready to serve.',
    },
  },
  GENERAL: {
    WATTSON_IN_SERVICE: 'Wattson, in service for Europe',
    COMMAND_INVALID_IN_DMS: 'This command may not be executed in DMs. Please perform this task on any server.',
  },
  UTIL: {
    EVENT_WELCOME: { EMBED_TITLE: 'Welcome', EMBED_DESCRIPTION: 'Welcome <@{name:string}>!' },
    COMMAND_RULES: {
      EMBED_HEADER_DESCRIPTION_1:
        'We allow people from all different kinds of perspectives as long as they follow the rules and chat in a constructive manner.',
      EMBED_HEADER_DESCRIPTION_2:
        'We may remove any content we deem inappropriate for any reason, as this server is not a neutral platform, content that reflects negatively on Volt can be removed.',
    },
    COMMAND_PING: {
      EMBED_TITLE: 'Wattson - Constable Pong',
      EMBED_DESCRIPTION: 'Ah! A signal most curious — I daresay, the latency is but a fleeting whisper..',
    },
  },
  MODERATION: {
    REPORT: {
      EMBED_TITLE: 'Message Reported',
      EMBED_OFFENDER: 'Offender',
      EMBED_REPORTER: 'Reporter',
      EMBED_CHANNEL: 'Channel',
      EMBED_REPORTED_MESSAGE: 'Link To Message',
    },
    COMMAND_REPORT: {
      EMBED_TITLE: 'Thank you for your report!',
      EMBED_DESCRIPTION:
        'This incident has been logged and a moderator notified. We will handle this case in due time. Please report any other message which can help us choose an appropriate decision.',
      EMBED_REPORTED_MESSAGE: 'Reported Message',
      EMBED_REPORTED_USER: 'Offender',
    },
  },
} satisfies BaseTranslation;

export default en;
