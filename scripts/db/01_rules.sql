-- Volt Europa Discord – server rules seed
-- Run against the wattson database after 0000_init.sql has been applied.
-- Safe to re-run: truncates the table first so there are no duplicates.

TRUNCATE rules RESTART IDENTITY CASCADE;

INSERT INTO rules (title, category, category_index, content, example) VALUES

-- ─── 1. General Guidelines ────────────────────────────────────────────────────
(
  'Follow Discord''s Terms of Service',
  'general', 1,
  'All members must comply with Discord''s Terms of Service at all times. '
  'These are the platform-wide rules set by Discord that govern every account '
  'and every server. Serious or repeated violations may result in your account '
  'being reported directly to Discord.',
  NULL
),
(
  'Follow Discord''s Community Guidelines',
  'general', 2,
  'All members must comply with Discord''s Community Guidelines. '
  'These guidelines address hate speech, harassment, self-harm content, '
  'and other harmful behaviour that Discord prohibits across the entire platform.',
  NULL
),

-- ─── 2. Behaviour ─────────────────────────────────────────────────────────────
(
  'No Discrimination or Extremist Ideologies',
  'behaviour', 1,
  'Discrimination of any kind is strictly prohibited. This includes — but is '
  'not limited to — racism, sexism, homophobia, and transphobia. '
  'Promoting or expressing support for extreme ideologies such as '
  'anti-democratic, violent, or fundamentalist belief systems is equally '
  'forbidden.',
  NULL
),
(
  'No Harassment or Disrespectful Behaviour',
  'behaviour', 2,
  'Bullying, harassment, hacking, doxxing, and any other form of '
  'disrespectful behaviour are not permitted — whether in public channels '
  'or in direct messages. Do not share the contents of private DM '
  'conversations publicly. The only exception is forwarding evidence to a '
  'moderator for a rule-violation report.',
  NULL
),
(
  'No Trolling',
  'behaviour', 3,
  'Trolling is not allowed. This includes posting messages purely to provoke '
  'a negative reaction from others, and making statements that are '
  'deliberately sarcastic or cynical in a way that derails conversation '
  'or upsets other members.',
  'Posting an inflammatory political take you do not actually hold just to watch others argue is trolling.'
),
(
  'Mark Sarcasm and Jokes Clearly',
  'behaviour', 4,
  'When you are being sarcastic or joking, make it obvious to avoid '
  'misunderstandings. You can do this by adding a tone indicator such as '
  '/s (sarcasm), /j (joking), or a 🃏 emoji at the end of your message.',
  '"Oh sure, letting everyone vote is clearly a terrible idea /s"'
),
(
  'Argue in Good Faith',
  'behaviour', 5,
  'When taking part in discussions, engage honestly and fairly. This means '
  'actually reading what others have written, remaining genuinely open to '
  'different perspectives, and responding thoughtfully — not just trying '
  'to win an argument or score points.',
  NULL
),
(
  'Do Not Block the Moderation Team',
  'behaviour', 6,
  'Blocking any member of the Volt Discord Team (moderators and admins) '
  'is not permitted. Moderators must be able to reach any member at any '
  'time for moderation purposes. Blocking them is treated as an attempt '
  'to evade moderation.',
  NULL
),
(
  'No Raid Encouragement',
  'behaviour', 7,
  'Encouraging, organising, or participating in raids against other Discord '
  'servers is strictly forbidden. Raiding means coordinating a mass '
  'disruption of another community.',
  NULL
),
(
  'No Persistent Disruptive Behaviour',
  'behaviour', 8,
  'Repeated patterns of disruptive behaviour are not allowed, even when '
  'individual incidents appear minor. This includes sustained negativity, '
  'persistent hostility towards other members, and attention-seeking '
  'behaviour that adds no value to the community.',
  NULL
),

-- ─── 3. Messages ──────────────────────────────────────────────────────────────
(
  'You Are Responsible for Your Account',
  'messages', 1,
  'You are responsible for all content posted from your account, regardless '
  'of who was at the keyboard. Claiming your account was compromised is not '
  'a valid excuse unless supported by credible evidence.',
  NULL
),
(
  'No Spamming',
  'messages', 2,
  'Spamming is not allowed in any form. This includes sending the same '
  'message repeatedly, flooding channels with memes or GIFs, and posting '
  'walls of emoji. Keep your contributions meaningful and readable.',
  NULL
),
(
  'No Misinformation',
  'messages', 3,
  'Spreading false or misleading information is not allowed. Back up factual '
  'claims with a credible and verifiable source. Unreliable sources are not '
  'accepted. Avoid making statements solely through screenshots or photos '
  'of news articles without proper context.',
  NULL
),
(
  'Sensitive Topics Are Restricted',
  'messages', 4,
  'Discussion of sensitive topics — such as self-harm, mental health crises, '
  'or similar subjects — is only permitted in the dedicated venting channel. '
  'Before posting there, read the pinned message carefully and use '
  'appropriate trigger warnings.',
  NULL
),
(
  'No Cross-Server Drama',
  'messages', 5,
  'Do not bring conflicts, feuds, or internal drama from other Discord '
  'servers into this community. Keep discussions focused on topics relevant '
  'to this server.',
  NULL
),

-- ─── 4. Voice ─────────────────────────────────────────────────────────────────
(
  'No Disruptive Sounds',
  'voice', 1,
  'Do not disrupt voice channel conversations with background noise, '
  'loud sounds, soundboards, or microphone abuse. Make sure your audio '
  'setup is clean before joining a call.',
  NULL
),
(
  'Share the Conversation',
  'voice', 2,
  'Do not monopolise a voice channel. Give other members a fair chance '
  'to speak. If a conversation is already in progress, wait for a natural '
  'pause before jumping in.',
  NULL
),
(
  'No Recording Calls',
  'voice', 3,
  'Recording voice or video calls in this server is not permitted without '
  'the explicit consent of every participant in the call. This applies to '
  'any recording method, including screen capture software.',
  NULL
),
(
  'No Illegal or Copyrighted Streaming',
  'voice', 4,
  'Do not stream or share illegal content in voice or video channels. '
  'This includes copyrighted films, music, TV shows, or any other '
  'trademarked material you do not have the rights to broadcast.',
  NULL
),
(
  'No Channel-Hopping',
  'voice', 5,
  'Rapidly switching between voice channels in quick succession '
  '(channel-hopping) is not allowed. It is disruptive to ongoing '
  'conversations and generates unnecessary notifications for other members.',
  NULL
),

-- ─── 5. Advertisements ────────────────────────────────────────────────────────
(
  'No Unauthorised Advertising',
  'advertisements', 1,
  'Advertising or promoting anything — including your own social media '
  'accounts, external communities, products, or services — requires prior '
  'written permission from the Volt Discord Team. Unsolicited promotion '
  'will be removed.',
  NULL
),
(
  'Volt-Related Promotion Is Welcome',
  'advertisements', 2,
  'Sharing content related to Volt Europa — such as campaign events, '
  'official announcements, or Volt''s official social media accounts — '
  'is permitted and encouraged without needing special approval.',
  NULL
),

-- ─── 6. Channels ──────────────────────────────────────────────────────────────
(
  'Stay On Topic',
  'channels', 1,
  'Each channel has a defined topic or purpose. Keep your messages '
  'relevant to the channel you are posting in. If you are unsure what '
  'a channel is for, check its description or pinned messages.',
  NULL
),
(
  'English in International Channels',
  'channels', 2,
  'All conversations in international channels must be in English so '
  'that every member can follow and participate in the discussion.',
  NULL
),
(
  'Local Languages in Country Channels',
  'channels', 3,
  'In country-specific or language-specific channels, members may '
  'communicate in the relevant local language in addition to English. '
  'Check the channel description to confirm which languages are '
  'appropriate for that channel.',
  NULL
),

-- ─── 7. Prohibited Content ────────────────────────────────────────────────────
(
  'No NSFW Content',
  'prohibited-content', 1,
  'Not Safe For Work (NSFW) content is strictly forbidden everywhere '
  'on this server. This includes pornographic images, videos, written '
  'descriptions, and any other sexually explicit material.',
  NULL
),
(
  'Extremist Symbols Only in Educational Contexts',
  'prohibited-content', 2,
  'Symbols associated with extreme ideologies — such as Nazi insignia '
  'or similar — are only permitted in educational contexts within the '
  'designated educational channels. Using such symbols casually, '
  'approvingly, or to intimidate others is forbidden.',
  NULL
),
(
  'No Piracy',
  'prohibited-content', 3,
  'Sharing, linking to, or promoting pirated content or piracy tools '
  'is not condoned. This includes cracked software, illegally distributed '
  'media files, and instructions for circumventing content protection '
  'systems.',
  NULL
),
(
  'Shitposting Only in #memes',
  'prohibited-content', 4,
  'Extensive shitposting, meme dumps, and off-topic humour are only '
  'permitted in the #memes channel. To gain access to that channel, '
  'assign yourself the "fun" role through the roles channel.',
  NULL
),
(
  'No Graphic Content',
  'prohibited-content', 5,
  'Graphic content of any kind is forbidden on this server. This '
  'includes violent imagery, gore, disturbing photographs, or any '
  'visual content that could cause distress to other members.',
  NULL
),

-- ─── 8. User Profiles ─────────────────────────────────────────────────────────
(
  'Appropriate Profile Content',
  'user-profiles', 1,
  'Your user profile — including your avatar, banner, display name, '
  'and status — must not contain controversial, offensive, or '
  'inappropriate imagery or text. Profiles that display extremist '
  'views, hate symbols, or targeted harassment will result in '
  'moderation action.',
  NULL
),
(
  'Readable Display Name Required',
  'user-profiles', 2,
  'Your display name must be easily readable and pronounceable, and '
  'must begin with a standard Latin alphabet letter (A–Z or a–z). '
  'Names that are invisible, consist entirely of symbols, or start '
  'with non-Latin characters are not permitted.',
  NULL
),
(
  'No Impersonation',
  'user-profiles', 3,
  'You may not impersonate other people through your profile. This '
  'includes adopting another person''s name, avatar, or any other '
  'identifying information to mislead other members about who you are.',
  NULL
),
(
  'One Account Per Person',
  'user-profiles', 4,
  'Each person may only maintain one account in this server at any '
  'given time. If you are found to have alternative (alt) accounts '
  'present in the server, those accounts will have their access '
  'revoked and their IDs logged.',
  NULL
),

-- ─── 9. Reporting ─────────────────────────────────────────────────────────────
(
  'Report Rule Breaks via the Bot',
  'reporting', 1,
  'If you witness another member breaking the rules, report it by '
  'replying to their message using the /report bot command. This '
  'creates a report that is immediately visible to the moderation '
  'team.',
  NULL
),
(
  'Ping Moderators for Urgent Issues',
  'reporting', 2,
  'If a rule violation requires an immediate response — such as '
  'ongoing harassment, hate speech, or illegal content — ping the '
  '@Volt Discord Team role or reach out directly to an individual '
  'moderator who is currently online.',
  NULL
),
(
  'No Bot Feature Abuse',
  'reporting', 3,
  'Abusing bot features or commands is not allowed. This includes '
  'spamming bot commands, attempting to exploit bot behaviour, or '
  'using bot features in ways they were not intended.',
  NULL
),
(
  'No Backseat Moderating',
  'reporting', 4,
  'Do not act as a moderator if you are not one. You may politely '
  'remind another member of the rules, but issuing demands, '
  'ultimatums, or formal warnings on behalf of the moderation team '
  'is not permitted.',
  NULL
),

-- ─── 10. Punishments ──────────────────────────────────────────────────────────
(
  'Standard Punishment Ladder',
  'punishments', 1,
  'Breaking the rules may result in a warning, a mute, or a ban. '
  'All punishments are logged and visible in the moderation log '
  'channel. The severity of the punishment depends on the nature '
  'of the violation and your prior history.',
  NULL
),
(
  'Immediate Bans for Severe Violations',
  'punishments', 2,
  'Moderators reserve the right to issue an immediate ban without '
  'prior warnings when the severity of a violation warrants it. '
  'This includes extreme harassment, hate speech, doxxing, or '
  'sharing illegal content.',
  NULL
),
(
  'Do Not Discuss Mod Actions Publicly',
  'punishments', 3,
  'Discussing moderation decisions — such as warnings, mutes, or '
  'bans — in public server channels is not allowed. If you have '
  'questions or concerns about a moderation action, contact the '
  'team privately via ModMail or the feedback channel.',
  NULL
),
(
  'Game Violations Are Separate from Server Rules',
  'punishments', 4,
  'Rule violations that occur during organised in-server games or '
  'events will not automatically result in Discord-level punishments. '
  'However, all server rules still apply during those events and in '
  'any related communications.',
  NULL
),
(
  'You Have the Right to Appeal',
  'punishments', 5,
  'Every punishment notification includes a reference to the specific '
  'rule that was broken. Warnings and mutes can be appealed via '
  'ModMail. Bans can be appealed using the official appeal form. '
  'All appeals are reviewed by the moderation team.',
  NULL
);
