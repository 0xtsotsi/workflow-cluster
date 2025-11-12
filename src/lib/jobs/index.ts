import { scheduler, ScheduledJob } from '../scheduler';
import { cleanupOAuthState } from './cleanup-oauth-state';
import { refreshExpiringTokens } from './refresh-expiring-tokens';
import { logger } from '../logger';
import { db } from '../db';
import { appSettingsTable } from '../schema';

/**
 * Define all your scheduled jobs here
 *
 * Cron expression examples:
 * - '* /5 * * * *' - Every 5 minutes
 * - '* /10 * * * *' - Every 10 minutes
 * - '* /30 * * * *' - Every 30 minutes
 * - '0 * * * *' - Every hour
 * - '0 0 * * *' - Every day at midnight
 * - '0 9 * * 1-5' - Every weekday at 9:00 AM
 * - '0 0 * * 0' - Every Sunday at midnight
 *
 * Set enabled: false to disable a job
 */
const jobs: ScheduledJob[] = [
  // Production jobs
  {
    name: 'cleanup-oauth-state',
    schedule: '*/15 * * * *', // Every 15 minutes
    task: cleanupOAuthState,
    enabled: true,
  },
  {
    name: 'refresh-expiring-tokens',
    schedule: '*/15 * * * *', // Every 15 minutes
    task: refreshExpiringTokens,
    enabled: true,
  },

  // Add your custom scheduled jobs here
  // Jobs are now managed through the workflow system
];

/**
 * Load settings from database for a specific job
 */
async function loadJobSettings(jobName: string): Promise<{ enabled?: boolean; interval?: string }> {
  try {
    const prefix = `${jobName}_`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allSettings = await (db as any)
      .select()
      .from(appSettingsTable) as Array<{ id: number; key: string; value: string; updatedAt: Date | null }>;

    const jobSettings = allSettings
      .filter((setting: { key: string }) => setting.key.startsWith(prefix))
      .reduce((acc: Record<string, unknown>, setting: { key: string; value: string }) => {
        const settingKey = setting.key.replace(prefix, '');
        try {
          acc[settingKey] = JSON.parse(setting.value);
        } catch {
          acc[settingKey] = setting.value;
        }
        return acc;
      }, {} as Record<string, unknown>);

    return {
      enabled: jobSettings.enabled as boolean | undefined,
      interval: jobSettings.interval as string | undefined,
    };
  } catch (error) {
    logger.error({ error, jobName }, 'Failed to load job settings from database');
    return {};
  }
}

/**
 * Initialize and start all scheduled jobs
 *
 * Uses node-cron for job scheduling.
 * Workflow-based jobs are managed through the workflow system separately.
 *
 * Jobs will load their enabled state and schedule from the database if configured via UI.
 */
export async function initializeScheduler() {
  // Simplified logging for development
  if (process.env.NODE_ENV !== 'development') {
    logger.info('Initializing job scheduler');
    logger.info('Note: Workflow-based jobs are managed through the workflow system');
  }

  // Load settings from database for each job
  for (const job of jobs) {
    const dbSettings = await loadJobSettings(job.name);

    // Use database settings if available, otherwise use defaults from jobs array
    const jobConfig: ScheduledJob = {
      name: job.name,
      schedule: dbSettings.interval || job.schedule,
      task: job.task,
      enabled: dbSettings.enabled !== undefined ? dbSettings.enabled : job.enabled,
    };

    scheduler.register(jobConfig);
  }

  scheduler.start();

  const enabledJobs = jobs.filter(async (job) => {
    const dbSettings = await loadJobSettings(job.name);
    return dbSettings.enabled !== undefined ? dbSettings.enabled : job.enabled;
  });

  // Only log in production or if explicitly requested
  if (process.env.NODE_ENV !== 'development' || process.env.LOG_SCHEDULER === 'true') {
    logger.info(
      { totalJobs: scheduler.getJobs().length, enabledCount: enabledJobs.length },
      'Node-cron scheduler started'
    );
  }
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler() {
  scheduler.stop();
}

// Export individual job functions for manual testing
export {
  cleanupOAuthState,
};
