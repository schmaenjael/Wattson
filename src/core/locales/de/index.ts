import type { BaseTranslation } from '../i18n-types.js';

const de = {
  SYSTEM: {
    STATUS: {
      STATE: 'Startstatus',
      SERVICE_LATENCY: 'Dienstlatenz',
      SERVICE_LAUNCH_TIME: 'Startzeitpunkt',
      SERVICE_UPTIME: 'Dienstverfügbarkeit',
      API_LATENCY: 'API-Latenz',
      DATABASE: 'Datenbankverbindung',
      SHARDS: 'Shard-Anzahl',
      LOADED_COMMANDS: 'Geladene Befehle',
    },
    EVENT_READY: {
      EMBED_TITLE: 'Wattson – Stets zu Diensten',
      EMBED_DESCRIPTION: 'Der ehrenwerte Detektiv Watson ist nun online und bereit, seinen Dienst anzutreten.',
    },
  },
  GENERAL: { WATTSON_IN_SERVICE: 'Wattson, im Dienst für Europa' },
  UTIL: {
    COMMAND_PING: {
      EMBED_TITLE: 'Wattson – Konstabler Pong',
      EMBED_DESCRIPTION: 'Ah! Ein gar seltsames Signal – ich wage zu behaupten, dass die Latenz kaum mehr als ein flüchtiges Flüstern ist...',
    },
  },
} satisfies BaseTranslation;

export default de;
