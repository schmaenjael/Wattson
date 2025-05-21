import type { BaseTranslation } from '../i18n-types.js';

const de = {
  SYSTEM: {
    ERROR: {
      EMBED_TITLE: 'Ein unerwarteter Fehler ist aufgetreten!',
      EMBED_DESCRIPTION: 'Ein Fehler ist beim Ausführen des Befehls aufgetreten, dieser Vorfall wird gemeldet.',
      EMBED_RECOVERABLE: 'Automatische Wiederherstellung',
      EMBED_MESSAGE: 'Fehlermeldung',
      EMBED_STACK: 'Fehlerprotokoll',
    },
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
  GENERAL: { WATTSON_IN_SERVICE: 'Wattson, im Dienst für Europa', COMMAND_INVALID_IN_DMS: 'Dieser Befehl muss auf einem Server ausgeführt werden.' },
  UTIL: {
    EVENT_WELCOME: { EMBED_TITLE: 'Willkommen!', EMBED_DESCRIPTION: 'Willkommen <@{name:string}>!' },
    COMMAND_PING: {
      EMBED_TITLE: 'Wattson – Konstabler Pong',
      EMBED_DESCRIPTION: 'Ah! Ein gar seltsames Signal – ich wage zu behaupten, dass die Latenz kaum mehr als ein flüchtiges Flüstern ist...',
    },
  },
  MODERATION: {
    COMMAND_REPORT: {
      EMBED_TITLE: 'Danke, dass du einen Regelbruch gemeldet hast!',
      EMBED_DESCRIPTION:
        'Dieser Vorfall wurde protokolliert und ein Moderator benachrichtigt. Wir werden diesen Fall zu gegebener Zeit bearbeiten. Bitte melden Sie uns jede weitere Nachricht, die uns helfen kann, eine angemessene Entscheidung zu treffen.',
      EMBED_REPORTED_MESSAGE: 'Gemeldete Nachricht',
      EMBED_REPORTED_USER: 'Gemeldeter Nutzer',
    },
  },
} satisfies BaseTranslation;

export default de;
