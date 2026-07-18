import { index, integer, jsonb, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { createdAt, ml, snowflake } from './shared';
import {
  harmSampleActionEnum,
  HarmSampleAction,
  harmSampleLabelEnum,
  HarmSampleLabel,
  harmSampleLabelSourceEnum,
  HarmSampleLabelSource,
} from './enums';

// Every harm-detector hit is captured here at decision time — text, context, raw model scores
// and the action taken — so it can be retro-labelled (see harmDetectionSamples repo) and exported
// as training data for the next model. Without this the triggering text is lost when the message
// is deleted.
//
// Lives in the `ml` schema as an append-only sink: `authorId` / `warningId` / `messageId` are
// stored as plain values (NO foreign keys) so the sample survives operational churn and the
// schema stays independently grantable/portable. Referential links are resolved by join at
// label time; GDPR erasure deletes rows by `authorId` directly.
export const harmDetectionSamples = ml.table(
  'harm_detection_samples',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    messageId: snowflake().notNull(),
    channelId: snowflake().notNull(),
    authorId: snowflake(),
    content: text().notNull(),
    // Conversation context window (prior turns / replied-to message). Populated from Phase 1 on.
    contextMessages: jsonb().$type<string[]>().notNull().default([]),
    // Internal harm-category keys the detector flagged (HarmCategory[] from the harm provider).
    detectedCategories: jsonb().$type<string[]>().notNull().default([]),
    // Raw per-category model scores, keyed by the model's own label.
    scores: jsonb().$type<Record<string, number>>().notNull().default({}),
    modelVersion: varchar({ length: 128 }).notNull(),
    action: harmSampleActionEnum().$type<HarmSampleAction>().notNull(),
    // Set when action = deleted_warned; a later revoke of this warning labels the sample a false positive.
    warningId: integer(),
    humanLabel: harmSampleLabelEnum().$type<HarmSampleLabel>(),
    labelSource: harmSampleLabelSourceEnum().$type<HarmSampleLabelSource>(),
    labeledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('harm_samples_message_idx').on(t.messageId),
    index('harm_samples_warning_idx').on(t.warningId),
    index('harm_samples_unlabeled_idx')
      .on(t.createdAt)
      .where(sql`${t.humanLabel} IS NULL`),
    index('harm_samples_created_at_brin').using('brin', t.createdAt),
  ]
);
