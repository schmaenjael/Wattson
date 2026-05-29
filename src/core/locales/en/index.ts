import type { BaseTranslation } from '../i18n-types.js';

const en = {
  SYSTEM: {
    VERIFICATION: {
      INITIAL: {
        EMBED_TITLE: '⚡ Welcome to Volt Europa!',
        EMBED_DESCRIPTION:
          "We're thrilled to have you here!\n\nBefore you can access the full server, we need you to answer a few quick questions. This keeps our community safe and welcoming for everyone.\n\n**This will only take about 2 minutes.**",
      },
      DISCLAIMER: {
        EMBED_TITLE: '🔐 Your privacy matters',
        FIELD_ANSWERS_TITLE: '📋 Your answers',
        FIELD_ANSWERS_VALUE: 'Not stored in our database. Only shared with the moderation team for review and automatically deleted after 12 months.',
        FIELD_MESSAGES_TITLE: '🔍 Message monitoring',
        FIELD_MESSAGES_VALUE:
          'During your stay we may inspect messages — manually or automatically — for harassment, discrimination, or other rule violations.',
        FIELD_MODERATION_TITLE: '⚠️ Moderation records',
        FIELD_MODERATION_VALUE:
          'Warnings, bans, and reports are stored in our database. You may request deletion at any time, but be aware that data deletion requests result in a **permanent ban** from the server.',
        FIELD_TIMELINE_TITLE: '⏱️ Processing time',
        FIELD_TIMELINE_VALUE: 'This review may take **a while**. We appreciate your patience.',
      },
      FINAL: {
        EMBED_TITLE: 'Thank you~',
        EMBED_DESCRIPTION:
          'Your answers have been submitted and are now under review by the moderation team. This process may take **a while** — we appreciate your patience!',
        VOLTER_HINT:
          '💜 **Are you a Volt member?** Once your verification is approved and you have server access, run `/verify volter` to receive your Volter role.',
      },
      DENIED: {
        EMBED_TITLE: 'We apologize!',
        EMBED_DESCRIPTION: 'Multiple moderators oppose your participation in the server for now. The reason is stated below.',
      },
      CANCELLED: {
        EMBED_TITLE: 'Verification cancelled',
        EMBED_DESCRIPTION: 'Your verification was cancelled. You can start again by using `/verify` in the server.',
      },
      ACCEPTED: {
        EMBED_TITLE: "And that's a wrap!",
        EMBED_DESCRIPTION: 'The final hurdle is completed - welcome to the Official Volt Europa Discord, we hope you enjoy your time!',
      },
      RESTART: {
        COMMAND_DESCRIPTION: 'Start or restart your server verification.',
        REVERIFY_COMMAND_DESCRIPTION: 'Re-submit your verification to the moderation team.',
        SUCCESS: '✅ Starting your verification — check your DMs!',
        ALREADY_ACTIVE: '⚠️ A verification is already in progress for your account.',
        ALREADY_VERIFIED: '✅ You are already verified and have full server access.',
      },
      QUESTIONS: {
        QUESTION_ICEBREAKER: {
          TITLE: 'If you could teleport anywhere in Europe right now, where would you go?',
          DESCRIPTION: "Hmmm... I think I'd visit the Kravica Waterfalls..! What about you?",
        },
        QUESTION_HOME_COUNTRY: {
          TITLE: 'Where do you call home?',
          DESCRIPTION:
            'Select your country or region. European members: pick your specific country. If your country is not listed, select "Other European country". Outside Europe: pick your continent.',
        },
        QUESTION_HOME_CONTINENT: {
          TITLE: 'What continent do you call home?',
          DESCRIPTION:
            'This is the bare minimum - if you have a specific reason for not wanting to share your location, please contact <@260460895761727491>.',
        },
        QUESTION_LANGUAGES_EU: {
          TITLE: 'Which European languages do you speak?',
          DESCRIPTION: 'Select all European languages you speak. English is shown by default — feel free to add more!',
        },
        QUESTION_LANGUAGES_OTHER: {
          TITLE: 'Any other languages?',
          DESCRIPTION: 'Select any world or constructed languages you speak (Arabic, Japanese, Esperanto, etc.).',
        },
        QUESTION_PRONOUNS: { TITLE: 'What are your pronouns?', DESCRIPTION: 'Please select your pronouns, so we may correctly refer to you!' },
        QUESTION_DISCOVERY: { TITLE: 'How did you come across our Volt Discord?', DESCRIPTION: "We're curious: How did you find us?" },
        QUESTION_RULE_ACCEPTANCE: {
          TITLE: '📜 Server Rules',
          DESCRIPTION:
            'Please read through **all pages** of the rules before you can accept. The accept button only appears on the last page. By agreeing you confirm you have read and understood all rules.',
        },
      },
    },
    VOLT_VERIFICATION: {
      EMBED_TITLE: '🟣 Volt Membership Verification',
      EMBED_DESCRIPTION:
        '**1.** Open this link: {url:string}\n**2.** Enter code `{code:string}` if not pre-filled\n**3.** Sign in with your Volt account\n\nThis code expires {expiry:string}.',
      SUCCESS_TITLE: '✅ Volt Membership Verified!',
      SUCCESS: 'Welcome, Volter! Your membership has been verified and will be valid for 12 months.',
      ALREADY_VERIFIED: '✅ You already have an active Volt verification, valid until {expiry:string}.',
      IN_PROGRESS: '⏳ A verification session is already in progress for your account. Please complete or wait for it to expire.',
      NOT_ENROLLED: '❌ You must complete `/verify start` and have server access before verifying your Volt membership.',
      TIMEOUT: '⏱️ Verification timed out. Please run `/verify volter` again to start a new session.',
      DENIED: '❌ You denied the authorization request. Run `/verify volter` to try again.',
      ERROR: '❌ Verification failed. Please try again later.',
      LOG_TITLE: '💜 Volt Membership Verified',
    },
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
    COMMAND_INVALID_PERMISSIONS: 'You do not have the required permissions to use this command.',
    COMMAND_DM_ONLY: 'This command is only available in direct messages.',
    COMMAND_GUILD_UNAVAILABLE: 'The server is temporarily unavailable. Please try again in a moment.',
    COMMAND_NOT_A_MEMBER: 'You must be a member of the server to use this command.',
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
    PURGE: {
      CONFIRM_TITLE: '⚠️ Confirm Data Purge',
      CONFIRM_DESCRIPTION:
        'This will permanently delete all warnings, bans, and reports for <@{userId:string}>. The user will receive a permanent ban. **This cannot be undone.**',
      CONFIRM_BUTTON: 'Confirm purge',
      CANCEL_BUTTON: 'Cancel',
      SUCCESS: 'Data purge complete for <@{userId:string}>. All records deleted, user permanently banned.',
      BAN_FAILED: 'Records deleted for <@{userId:string}>, but Discord ban failed. Please ban the user manually.',
      CANCELLED: 'Purge cancelled.',
    },
    GDPR_REQUEST: {
      CONFIRM_TITLE: '🔐 Request Data Deletion (GDPR/DSGVO)',
      CONFIRM_DESCRIPTION:
        'Submitting this request will permanently erase your personal data from our records. A moderator must approve the request before it is executed.',
      WILL_DELETE_TITLE: '✅ Will be permanently deleted',
      WILL_DELETE_VALUE:
        '• Warnings issued against you\n• Bans and ban history\n• Reports involving you\n• Court case records\n• Slur violation logs\n• Username change history\n• Starboard metadata\n• Our server audit log entries',
      CANNOT_DELETE_TITLE: '❌ Cannot be deleted',
      CANNOT_DELETE_VALUE:
        "• **Your Discord messages** in this server — Discord controls message history\n• **Starboard content** already published externally (Bluesky, Instagram, Haiilo) — we cannot recall published posts\n• **Discord's own records** — platform-level audit logs, message data, etc.",
      BAN_WARNING: '⚠️ **This results in a permanent ban from the server.** You will not be able to rejoin after approval.',
      CONFIRM_BUTTON: 'Submit Request',
      CANCEL_BUTTON: 'Cancel',
      SUBMITTED:
        'Your data deletion request has been submitted and is awaiting moderator approval. You will be notified via DM once a decision is made.',
      CANCELLED: 'Data deletion request cancelled.',
      DM_EXECUTED_TITLE: 'Your Data Deletion Request Has Been Processed',
      DM_EXECUTED_DESCRIPTION:
        'A moderator has approved your data deletion request. All eligible personal data has been permanently erased from our server records.',
      DM_DELETED_TITLE: '✅ Deleted from our records',
      DM_DELETED_VALUE: 'Warnings, bans, reports, court cases, slur violations, username history, audit log entries, and starboard metadata.',
      DM_NOT_DELETED_TITLE: '❌ Outside our control — not deleted',
      DM_NOT_DELETED_VALUE:
        "Discord messages you sent in the server, starboard content already published to external platforms (Bluesky, Instagram, Haiilo), and Discord's own platform records.",
      DM_BAN_NOTICE: 'As part of this process, you have been permanently banned from the server.',
      DM_DENIED_TITLE: 'Data Deletion Request Denied',
      DM_DENIED_DESCRIPTION: 'The moderation team has reviewed your data deletion request and denied it. No data was modified.',
    },
  },
  EVENT: {
    COMMAND_CREATE: {
      SUCCESS: '✅ Event **{name:string}** created with ID `{id:number}`. Scheduled for {time:string}.',
      ERROR_INVALID_DATE: '❌ Invalid date or time format. Use `YYYY-MM-DD` for date and `HH:MM` for time.',
      ERROR_PAST_DATE: '❌ The event date must be in the future.',
    },
    COMMAND_RECREATE: {
      SUCCESS: '✅ Event recreated as `{id:number}`. Scheduled for {time:string}.',
      ERROR_NOT_FOUND: '❌ No event found with ID `{id:number}`.',
      ERROR_NOT_OWNER: '❌ You can only recreate events you created.',
    },
    COMMAND_REPEAT: {
      SET: '✅ Recurring schedule set for event `{id:number}`: `{cron:string}`.',
      CLEARED: '✅ Recurring schedule cleared for event `{id:number}`.',
      ERROR_INVALID_CRON: '❌ Invalid cron expression. Example: `0 18 * * 5` for every Friday at 18:00.',
    },
    COMMAND_DASHBOARD: { TITLE: 'Your Events', EMPTY: 'You have no events in the last 30 days or upcoming.' },
    COMMAND_LIST: { TITLE: 'Upcoming Events', EMPTY: 'There are no upcoming events.', SIGNED_UP: '✅ Signed up for {count:number} event(s).' },
    COMMAND_REGISTER: {
      SUCCESS: '✅ You are now registered for **{name:string}** ({time:string}).',
      ALREADY_REGISTERED: '⚠️ You are already registered for this event.',
      ERROR_NOT_FOUND: '❌ No event found with ID `{id:number}`.',
      ERROR_PAST_OR_CANCELLED: '❌ This event has already passed or been cancelled.',
    },
    COMMAND_UNREGISTER: {
      SUCCESS: '✅ You have been removed from **{name:string}**.',
      NOT_REGISTERED: '⚠️ You are not registered for this event.',
      ERROR_NOT_FOUND: '❌ No event found with ID `{id:number}`.',
    },
    COMMAND_CANCEL: {
      SUCCESS: '✅ Event `{id:number}` cancelled. {count:number} registrant(s) notified.',
      ERROR_NOT_FOUND: '❌ No event found with ID `{id:number}`.',
      ERROR_NOT_OWNER: '❌ You can only cancel events you created.',
      DM_NOTIFY: '**{name:string}** (scheduled for {time:string}) has been cancelled.',
    },
    COMMAND_ATTENDEES: { TITLE: 'Attendees for {name:string}', EMPTY: 'No one has registered for this event yet.' },
    ANNOUNCEMENT: {
      EMBED_TITLE: '📅 Event Starting Soon',
      EMBED_DESCRIPTION: '**{name:string}** begins {time:string}.',
      NO_REGISTRANTS: 'No registered attendees.',
    },
    WEEKLY_DIGEST: {
      EMBED_TITLE: '📅 Events This Week',
      EMBED_DESCRIPTION: 'Here are the upcoming events for the next 7 days.',
      NO_EVENTS: 'No events scheduled for the next 7 days.',
    },
  },
} satisfies BaseTranslation;

export default en;
