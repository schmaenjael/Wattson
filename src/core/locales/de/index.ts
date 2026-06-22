import type { BaseTranslation } from '~/core/locales';

const de = {
  SYSTEM: {
    VERIFICATION: {
      INITIAL: {
        EMBED_TITLE: '⚡ Willkommen bei Volt Europa!',
        EMBED_DESCRIPTION:
          'Schön, dass du da bist!\n\nBevor du Zugang zum gesamten Server bekommst, stellen wir dir ein paar kurze Fragen. Das hält unsere Community sicher und einladend für alle.\n\n**Dauert nur etwa 2 Minuten.**',
      },
      DISCLAIMER: {
        EMBED_TITLE: '🔐 Deine Privatsphäre liegt uns am Herzen',
        FIELD_ANSWERS_TITLE: '📋 Deine Antworten',
        FIELD_ANSWERS_VALUE:
          'Werden nicht in unserer Datenbank gespeichert. Nur dem Moderationsteam zugänglich und nach 12 Monaten automatisch gelöscht.',
        FIELD_MESSAGES_TITLE: '🔍 Nachrichtenüberwachung',
        FIELD_MESSAGES_VALUE:
          'Während deines Aufenthalts können wir Nachrichten – manuell oder automatisch – auf Belästigung, Diskriminierung oder andere Regelverstöße prüfen.',
        FIELD_MODERATION_TITLE: '⚠️ Moderationsaufzeichnungen',
        FIELD_MODERATION_VALUE:
          'Verwarnungen, Bans und Meldungen werden in unserer Datenbank gespeichert. Du kannst jederzeit die Löschung beantragen, aber beachte: Datenlöschungsanfragen führen zu einem **permanenten Ban** vom Server.',
        FIELD_TIMELINE_TITLE: '⏱️ Bearbeitungszeit',
        FIELD_TIMELINE_VALUE: 'Die Prüfung kann **mehrere Tage** dauern. Wir schätzen deine Geduld.',
      },
      FINAL: {
        EMBED_TITLE: 'Danke dir~',
        EMBED_DESCRIPTION:
          'Deine Antworten wurden eingereicht und werden vom Moderationsteam geprüft. Dieser Prozess kann **mehrere Tage** dauern – vielen Dank für deine Geduld!',
        VOLTER_HINT:
          '💜 **Bist du Volt-Mitglied?** Sobald deine Verifizierung genehmigt wurde und du Serverzugang hast, führe `/verify volter` aus, um deine Volter-Rolle zu erhalten.',
      },
      DENIED: {
        EMBED_TITLE: 'Es tut uns leid!',
        EMBED_DESCRIPTION: 'Mehrere Moderator*innen haben deiner Teilnahme im Moment widersprochen. Der Grund steht unten.',
      },
      CANCELLED: {
        EMBED_TITLE: 'Verifizierung abgebrochen',
        EMBED_DESCRIPTION: 'Deine Verifizierung wurde abgebrochen. Du kannst erneut beginnen, indem du `/verify` im Server verwendest.',
      },
      ACCEPTED: {
        EMBED_TITLE: 'Geschafft!',
        EMBED_DESCRIPTION: 'Die letzte Hürde ist genommen – willkommen auf dem offiziellen Volt-Europa-Discord! Schön, dass du hier bist!',
      },
      RESTART: {
        COMMAND_DESCRIPTION: 'Starte oder starte deine Server-Verifizierung neu.',
        REVERIFY_COMMAND_DESCRIPTION: 'Reiche deine Verifizierung erneut beim Moderationsteam ein.',
        SUCCESS: '✅ Deine Verifizierung startet – prüfe deine DMs!',
        ALREADY_ACTIVE: '⚠️ Für dein Konto läuft bereits eine Verifizierung.',
        ALREADY_VERIFIED: '✅ Du bist bereits verifiziert und hast vollen Zugang zum Server.',
      },
      QUESTIONS: {
        CAPTCHA: { TITLE: '🤖 Bist du ein Mensch?', DESCRIPTION: 'Gib die Zeichen aus dem Bild unten ein. Das hilft uns, Bots fernzuhalten.' },
        QUESTION_ICEBREAKER: {
          TITLE: 'Wenn du dich gerade irgendwo in Europa hinbeamen könntest – wohin ginge die Reise?',
          DESCRIPTION: 'Hmm... ich glaub, ich würd zu den Kravica-Wasserfällen düsen! Und du?',
        },
        QUESTION_HOME_COUNTRY: {
          TITLE: 'Wo nennst du dein Zuhause?',
          DESCRIPTION:
            'Wähle dein Land oder deine Region. Europäische Mitglieder: bitte wähle dein konkretes Land. Nicht in der Liste? Dann wähle „Other European country". Außerhalb Europas: wähle deinen Kontinent.',
        },
        QUESTION_HOME_CONTINENT: {
          TITLE: 'Auf welchem Kontinent lebst du?',
          DESCRIPTION:
            'Das ist das absolute Minimum. Wenn du aus persönlichen Gründen deinen Standort nicht teilen möchtest, melde dich bitte bei <@260460895761727491>.',
        },
        QUESTION_LANGUAGES_EU: {
          TITLE: 'Welche europäischen Sprachen sprichst du?',
          DESCRIPTION: 'Wähle alle europäischen Sprachen aus, die du beherrschst. Englisch ist als Standard voreingestellt – ergänze gerne weitere!',
        },
        QUESTION_LANGUAGES_OTHER: {
          TITLE: 'Noch weitere Sprachen?',
          DESCRIPTION: 'Wähle weitere Welt- oder Plansprachen aus, die du sprichst (Arabisch, Japanisch, Esperanto usw.).',
        },
        QUESTION_PRONOUNS: { TITLE: 'Welche Pronomen verwendest du?', DESCRIPTION: 'So können wir dich korrekt ansprechen – danke fürs Ausfüllen!' },
        QUESTION_DISCOVERY: { TITLE: 'Wie bist du auf den Volt-Discord gestoßen?', DESCRIPTION: 'Wir sind neugierig: Wie hast du uns gefunden?' },
        QUESTION_RULE_ACCEPTANCE: {
          TITLE: '📜 Serverregeln',
          DESCRIPTION:
            'Bitte lies **alle Seiten** der Regeln durch, bevor du zustimmen kannst. Der Zustimmungs-Button erscheint erst auf der letzten Seite. Mit deiner Zustimmung bestätigst du, alle Regeln gelesen und verstanden zu haben.',
        },
      },
    },
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
    VOLT_VERIFICATION: {
      EMBED_TITLE: '🟣 Volt-Mitgliedschaft verifizieren',
      EMBED_DESCRIPTION:
        '**1.** Öffne diesen Link: {url:string}\n**2.** Gib den Code `{code:string}` ein, falls nicht vorausgefüllt\n**3.** Melde dich mit deinem Volt-Konto an\n\nDieser Code läuft ab {expiry:string}.',
      SUCCESS_TITLE: '✅ Volt-Mitgliedschaft verifiziert!',
      SUCCESS: 'Willkommen, Volter! Deine Mitgliedschaft wurde bestätigt und ist 12 Monate lang gültig.',
      ALREADY_VERIFIED: '✅ Du hast bereits eine aktive Volt-Verifizierung, gültig bis {expiry:string}.',
      IN_PROGRESS: '⏳ Für dein Konto läuft bereits eine Verifizierungssitzung. Bitte schließe diese ab oder warte, bis sie abläuft.',
      NOT_ENROLLED: '❌ Du musst zuerst `/verify start` abschließen und Serverzugang haben, bevor du deine Volt-Mitgliedschaft verifizieren kannst.',
      TIMEOUT: '⏱️ Verifizierung abgelaufen. Bitte starte mit `/verify volter` eine neue Sitzung.',
      DENIED: '❌ Du hast die Autorisierung abgelehnt. Versuche es mit `/verify volter` erneut.',
      ERROR: '❌ Verifizierung fehlgeschlagen. Bitte versuche es später erneut.',
      LOG_TITLE: '💜 Volt-Mitgliedschaft verifiziert',
    },
  },
  GENERAL: {
    WATTSON_IN_SERVICE: 'Wattson, im Dienst für Europa',
    COMMAND_INVALID_IN_DMS: 'Dieser Befehl muss auf einem Server ausgeführt werden.',
    COMMAND_INVALID_PERMISSIONS: 'Dir fehlen die nötigen Berechtigungen für diesen Befehl.',
    COMMAND_DM_ONLY: 'Dieser Befehl ist nur in Direktnachrichten verfügbar.',
    COMMAND_GUILD_UNAVAILABLE: 'Der Server ist vorübergehend nicht erreichbar. Bitte versuche es gleich noch einmal.',
    COMMAND_NOT_A_MEMBER: 'Du musst Mitglied des Servers sein, um diesen Befehl zu verwenden.',
  },
  UTIL: {
    EVENT_WELCOME: { EMBED_TITLE: 'Willkommen!', EMBED_DESCRIPTION: 'Willkommen <@{name:string}>!' },
    COMMAND_RULES: {
      EMBED_HEADER_DESCRIPTION_1: 'Wir begrüßen Menschen aller Perspektiven, solange sie die Regeln befolgen und konstruktiv kommunizieren.',
      EMBED_HEADER_DESCRIPTION_2:
        'Wir können Inhalte, die wir als unangemessen erachten, jederzeit entfernen, da dieser Server keine neutrale Plattform ist.',
    },
    COMMAND_PING: {
      EMBED_TITLE: 'Wattson – Konstabler Pong',
      EMBED_DESCRIPTION: 'Ah! Ein gar seltsames Signal – ich wage zu behaupten, dass die Latenz kaum mehr als ein flüchtiges Flüstern ist...',
    },
  },
  MODERATION: {
    REPORT: {
      EMBED_TITLE: 'Nachricht gemeldet',
      EMBED_OFFENDER: 'Verstoß von',
      EMBED_REPORTER: 'Gemeldet von',
      EMBED_CHANNEL: 'Kanal',
      EMBED_REPORTED_MESSAGE: 'Link zur Nachricht',
    },
    COMMAND_REPORT: {
      EMBED_TITLE: 'Danke, dass du einen Regelbruch gemeldet hast!',
      EMBED_DESCRIPTION:
        'Dieser Vorfall wurde protokolliert und ein Moderator benachrichtigt. Wir werden diesen Fall zu gegebener Zeit bearbeiten. Bitte melden Sie uns jede weitere Nachricht, die uns helfen kann, eine angemessene Entscheidung zu treffen.',
      EMBED_REPORTED_MESSAGE: 'Gemeldete Nachricht',
      EMBED_REPORTED_USER: 'Gemeldeter Nutzer',
    },
    PURGE: {
      CONFIRM_TITLE: '⚠️ Datenlöschung bestätigen',
      CONFIRM_DESCRIPTION:
        'Alle Verwarnungen, Bans und Meldungen für <@{userId:string}> werden dauerhaft gelöscht. Der Nutzer erhält einen permanenten Ban. **Dieser Vorgang kann nicht rückgängig gemacht werden.**',
      CONFIRM_BUTTON: 'Löschung bestätigen',
      CANCEL_BUTTON: 'Abbrechen',
      SUCCESS: 'Datenlöschung für <@{userId:string}> abgeschlossen. Alle Einträge gelöscht, Nutzer permanent gebannt.',
      BAN_FAILED: 'Einträge für <@{userId:string}> gelöscht, Discord-Ban jedoch fehlgeschlagen. Bitte den Nutzer manuell bannen.',
      CANCELLED: 'Löschung abgebrochen.',
    },
    GDPR_REQUEST: {
      CONFIRM_TITLE: '🔐 Datenlöschung beantragen (DSGVO/GDPR)',
      CONFIRM_DESCRIPTION:
        'Mit diesem Antrag werden deine personenbezogenen Daten dauerhaft aus unseren Aufzeichnungen gelöscht. Ein Moderator muss den Antrag erst genehmigen, bevor er ausgeführt wird.',
      WILL_DELETE_TITLE: '✅ Wird dauerhaft gelöscht',
      WILL_DELETE_VALUE:
        '• Verwarnungen gegen dich\n• Bans und Ban-Verlauf\n• Meldungen, an denen du beteiligt warst\n• Gerichtsfallakten\n• Slur-Verstöße\n• Nutzernamen-Verlauf\n• Starboard-Metadaten\n• Einträge in unserem Server-Auditlog',
      CANNOT_DELETE_TITLE: '❌ Kann nicht gelöscht werden',
      CANNOT_DELETE_VALUE:
        '• **Deine Discord-Nachrichten** auf diesem Server — Discord verwaltet den Nachrichtenverlauf\n• **Starboard-Inhalte**, die bereits auf externen Plattformen veröffentlicht wurden (Bluesky, Instagram, Haiilo) — veröffentlichte Beiträge können nicht zurückgezogen werden\n• **Discords eigene Aufzeichnungen** — plattformseitige Auditlogs, Nachrichtendaten usw.',
      BAN_WARNING: '⚠️ **Dies führt zu einem permanenten Ban vom Server.** Du kannst nach der Genehmigung nicht mehr beitreten.',
      CONFIRM_BUTTON: 'Antrag stellen',
      CANCEL_BUTTON: 'Abbrechen',
      SUBMITTED:
        'Dein Datenlöschungsantrag wurde eingereicht und wartet auf die Genehmigung durch einen Moderator. Du wirst per DM über die Entscheidung informiert.',
      CANCELLED: 'Datenlöschungsantrag abgebrochen.',
      DM_EXECUTED_TITLE: 'Dein Datenlöschungsantrag wurde bearbeitet',
      DM_EXECUTED_DESCRIPTION:
        'Ein Moderator hat deinen Datenlöschungsantrag genehmigt. Alle zutreffenden personenbezogenen Daten wurden dauerhaft aus unseren Serveraufzeichnungen gelöscht.',
      DM_DELETED_TITLE: '✅ Aus unseren Aufzeichnungen gelöscht',
      DM_DELETED_VALUE:
        'Verwarnungen, Bans, Meldungen, Gerichtsfälle, Slur-Verstöße, Nutzernamen-Verlauf, Auditlog-Einträge und Starboard-Metadaten.',
      DM_NOT_DELETED_TITLE: '❌ Außerhalb unserer Kontrolle – nicht gelöscht',
      DM_NOT_DELETED_VALUE:
        'Deine Nachrichten auf dem Server, Starboard-Inhalte, die bereits auf externen Plattformen veröffentlicht wurden (Bluesky, Instagram, Haiilo), sowie Discords eigene Plattformdaten.',
      DM_BAN_NOTICE: 'Im Rahmen dieses Prozesses wurdest du dauerhaft vom Server gebannt.',
      DM_DENIED_TITLE: 'Datenlöschungsantrag abgelehnt',
      DM_DENIED_DESCRIPTION: 'Das Moderationsteam hat deinen Datenlöschungsantrag geprüft und abgelehnt. Es wurden keine Daten verändert.',
    },
    APPEAL: {
      EMBED_TITLE: '📬 Bann-Einspruch',
      EMBED_DESCRIPTION: '<@{userId:string}> hat einen Bann-Einspruch eingereicht.',
      FIELD_APPELLANT: '👤 Einspruchsteller',
      FIELD_ACCOUNT_CREATED: '📅 Konto erstellt',
      FIELD_EMAIL: '📧 E-Mail',
      FIELD_REASON: '⚖️ Warum ich entbannt werden sollte',
      FIELD_ADDITIONAL: '💬 Zusätzliche Informationen',
      FIELD_ORIGINAL_BAN: '🔨 Ursprünglicher Bann-Grund',
      FIELD_BANNED: '🕐 Gebannt',
      FIELD_APPROVALS: '🗳️ Zustimmungen',
      BUTTON_APPROVE: 'Annehmen ({voteCount:number}/{threshold:number})',
      BUTTON_DENY: 'Ablehnen',
      FOOTER: 'Einspruch #{appealId:number}',
      SUBMIT_INVALID: 'Dieser Einspruch ist nicht mehr gültig. Dein Bann wurde möglicherweise bereits aufgehoben oder es wurde bereits ein Einspruch eingereicht.',
      NOT_CONFIGURED: 'Das Einspruchssystem ist nicht konfiguriert. Bitte kontaktiere das Moderationsteam direkt.',
      CHANNEL_UNAVAILABLE: 'Der Einspruchskanal ist nicht verfügbar. Bitte kontaktiere das Moderationsteam direkt.',
      SUBMITTED:
        '✅ Dein Einspruch wurde erfolgreich eingereicht. Das Moderationsteam wird ihn prüfen und du wirst hier per DM benachrichtigt, sobald eine Entscheidung getroffen wurde.',
      RECORD_NOT_FOUND: 'Einspruchs-Datensatz nicht gefunden.',
      ALREADY_RESOLVED: 'Dieser Einspruch wurde bereits bearbeitet.',
      BAN_NOT_FOUND: 'Bann-Datensatz nicht gefunden.',
      ALREADY_VOTED: 'Du hast bereits für die Annahme dieses Einspruchs gestimmt.',
      VOTE_RECORDED: '✅ Stimme erfasst. {voteCount:number}/{threshold:number} Zustimmungen erforderlich.',
      GRANTED_TITLE: '✅ Bann-Einspruch — Angenommen',
      OUTCOME_GRANTED_LABEL: '✅ Ergebnis',
      OUTCOME_GRANTED_VALUE: 'Einspruch nach **{voteCount:number}** Moderator-Stimmen angenommen. Letzte Stimme von <@{userId:string}>.',
      GRANTED_REPLY: '✅ Einspruch angenommen.',
      GRANTED_REPLY_UNBANNED: '✅ Einspruch angenommen. <@{userId:string}> wurde entbannt.',
      DENIED_TITLE: '❌ Bann-Einspruch — Abgelehnt',
      OUTCOME_DENIED_LABEL: '❌ Ergebnis',
      OUTCOME_DENIED_VALUE: 'Einspruch von <@{userId:string}> abgelehnt. Der Bann bleibt bestehen.',
      DENIED_REPLY: '❌ Einspruch abgelehnt.',
      DENIED_REPLY_REMAINS: '❌ Einspruch abgelehnt. Der Bann von <@{userId:string}> bleibt bestehen.',
      DM_GRANTED_TITLE: '✅ Bann-Einspruch angenommen',
      DM_GRANTED_DESCRIPTION:
        'Dein Bann-Einspruch wurde vom Moderationsteam geprüft und **angenommen**.\n\nDu wurdest entbannt und kannst dem Server wieder beitreten.',
      DM_DENIED_TITLE: '❌ Bann-Einspruch abgelehnt',
      DM_DENIED_DESCRIPTION: 'Dein Bann-Einspruch wurde vom Moderationsteam geprüft und **abgelehnt**.\n\nDein Bann bleibt bestehen.',
      NO_APPEALABLE_BAN: 'Du hast keinen aktiven, anfechtbaren Bann, oder dein Einspruch wurde bereits eingereicht.',
      MODAL_TITLE: 'Bann-Einspruch',
      MODAL_EMAIL_LABEL: 'Deine E-Mail-Adresse',
      MODAL_REASON_LABEL: 'Warum solltest du entbannt werden?',
      MODAL_REASON_PLACEHOLDER:
        'Hier kannst du schreiben, warum du entbannt werden solltest. Entweder 1) warum du den Bann für ungerechtfertigt und falsch hältst oder 2) dass sich deine Ansichten geändert haben. Bitte begründe dies mit überzeugenden Argumenten.',
      MODAL_OTHER_LABEL: 'Möchtest du uns noch etwas mitteilen?',
    },
  },
  EVENT: {
    COMMAND_CREATE: {
      SUCCESS: '✅ Veranstaltung **{name:string}** mit ID `{id:number}` erstellt. Geplant für {time:string}.',
      ERROR_INVALID_DATE: '❌ Ungültiges Datums- oder Zeitformat. Verwende `JJJJ-MM-TT` für das Datum und `HH:MM` für die Zeit.',
      ERROR_PAST_DATE: '❌ Das Datum der Veranstaltung muss in der Zukunft liegen.',
    },
    COMMAND_RECREATE: {
      SUCCESS: '✅ Veranstaltung neu erstellt als `{id:number}`. Geplant für {time:string}.',
      ERROR_NOT_FOUND: '❌ Keine Veranstaltung mit ID `{id:number}` gefunden.',
      ERROR_NOT_OWNER: '❌ Du kannst nur Veranstaltungen neu erstellen, die du selbst angelegt hast.',
    },
    COMMAND_REPEAT: {
      SET: '✅ Wiederholungsplan für Veranstaltung `{id:number}` gesetzt: `{cron:string}`.',
      CLEARED: '✅ Wiederholungsplan für Veranstaltung `{id:number}` entfernt.',
      ERROR_INVALID_CRON: '❌ Ungültiger Cron-Ausdruck. Beispiel: `0 18 * * 5` für jeden Freitag um 18:00 Uhr.',
    },
    COMMAND_DASHBOARD: { TITLE: 'Deine Veranstaltungen', EMPTY: 'Du hast keine Veranstaltungen in den letzten 30 Tagen oder in der Zukunft.' },
    COMMAND_LIST: {
      TITLE: 'Bevorstehende Veranstaltungen',
      EMPTY: 'Es sind keine bevorstehenden Veranstaltungen geplant.',
      SIGNED_UP: '✅ Du hast dich für {count:number} Veranstaltung(en) angemeldet.',
    },
    COMMAND_REGISTER: {
      SUCCESS: '✅ Du bist jetzt für **{name:string}** ({time:string}) angemeldet.',
      ALREADY_REGISTERED: '⚠️ Du bist bereits für diese Veranstaltung angemeldet.',
      ERROR_NOT_FOUND: '❌ Keine Veranstaltung mit ID `{id:number}` gefunden.',
      ERROR_PAST_OR_CANCELLED: '❌ Diese Veranstaltung ist bereits abgelaufen oder wurde abgesagt.',
    },
    COMMAND_UNREGISTER: {
      SUCCESS: '✅ Du wurdest von **{name:string}** abgemeldet.',
      NOT_REGISTERED: '⚠️ Du bist nicht für diese Veranstaltung angemeldet.',
      ERROR_NOT_FOUND: '❌ Keine Veranstaltung mit ID `{id:number}` gefunden.',
    },
    COMMAND_CANCEL: {
      SUCCESS: '✅ Veranstaltung `{id:number}` abgesagt. {count:number} Angemeldete(r) wurde(n) benachrichtigt.',
      ERROR_NOT_FOUND: '❌ Keine Veranstaltung mit ID `{id:number}` gefunden.',
      ERROR_NOT_OWNER: '❌ Du kannst nur Veranstaltungen absagen, die du selbst angelegt hast.',
      DM_NOTIFY: '**{name:string}** (geplant für {time:string}) wurde abgesagt.',
    },
    COMMAND_ATTENDEES: { TITLE: 'Angemeldete für {name:string}', EMPTY: 'Noch niemand hat sich für diese Veranstaltung angemeldet.' },
    ANNOUNCEMENT: {
      EMBED_TITLE: '📅 Veranstaltung beginnt bald',
      EMBED_DESCRIPTION: '**{name:string}** beginnt {time:string}.',
      NO_REGISTRANTS: 'Keine angemeldeten Teilnehmer.',
    },
    WEEKLY_DIGEST: {
      EMBED_TITLE: '📅 Veranstaltungen diese Woche',
      EMBED_DESCRIPTION: 'Hier sind die bevorstehenden Veranstaltungen der nächsten 7 Tage.',
      NO_EVENTS: 'Keine Veranstaltungen für die nächsten 7 Tage geplant.',
    },
  },
} satisfies BaseTranslation;

export default de;
