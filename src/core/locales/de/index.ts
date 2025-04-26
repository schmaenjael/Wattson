import type { BaseTranslation } from '../i18n-types.js';

const de = {
  GENERAL: { EMBED_FOOTER_TEXT: 'Wattson, im Dienst für Europa' },
  UTIL: {
    PING: {
      RESPONSE_TITLE: 'Wattson - Konstabler Pong',
      RESPONSE_DESCRIPTION:
        'Ah! Ein gar seltsames Signal - ich wage zu behaupten, dass die Latenz kaum mehr als ein flüchtiges Fähnchen im Winde ist...',
      RESPONSE_FIELD_SERVICE_LATENCY: 'Dienstlatenz',
      RESPONSE_FIELD_SERVICE_UPTIME: 'Dienstverfügbarkeit',
      RESPONSE_FIELD_API_LATENCY: 'API-Latenz',
    },
  },
} satisfies BaseTranslation;

export default de;
