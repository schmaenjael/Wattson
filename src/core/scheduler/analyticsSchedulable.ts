import { AppFeature } from '~/settings';
import { Schedulable } from '~/core/models/Schedulable';
import { flushAnalytics } from '~/core/providers/analytics';

export const analyticsSchedulable = new Schedulable({
  name: 'analytics-schedulable',
  feature: AppFeature.Analytics,
  description: 'Flushes buffered member activity (messages, voice time, reactions) to the database.',
  defaultCron: '*/5 * * * *',
  execute: async () => {
    const flushed = await flushAnalytics();
    if (flushed === 0) {
      return;
    }
    return `Flushed activity for ${flushed} member(s).`;
  },
});
