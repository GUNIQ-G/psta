import cron from 'node-cron';
import ldapSyncService from '../services/ldap-sync.service';
import { appLogger, errorLogger } from '../config/logger';

/**
 * LDAP Sync Job
 * Runs daily at 2:00 AM to sync LDAP data with PSTA
 */

let isJobRunning = false;

export function startLdapSyncJob() {
  // Schedule: Every day at 2:00 AM (Korean time)
  // Cron format: second minute hour day month weekday
  // '0 2 * * *' = At 02:00:00 every day
  const cronExpression = '0 2 * * *';

  cron.schedule(cronExpression, async () => {
    if (isJobRunning) {
      appLogger.warn('LDAP sync job already running, skipping this execution');
      return;
    }

    try {
      isJobRunning = true;
      appLogger.info('Starting scheduled LDAP sync job');

      const result = await ldapSyncService.syncFromLdap(false);

      if (result.success) {
        appLogger.info('Scheduled LDAP sync completed successfully', {
          teamsCreated: result.teamsCreated,
          teamsDeactivated: result.teamsDeactivated,
          usersDeactivated: result.usersDeactivated,
          teamMembershipsUpdated: result.teamMembershipsUpdated,
        });
      } else {
        errorLogger.error('Scheduled LDAP sync failed', {
          errors: result.errors,
        });
      }
    } catch (error: any) {
      errorLogger.error('LDAP sync job error', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      isJobRunning = false;
    }
  }, {
    timezone: 'Asia/Seoul',
  });

  appLogger.info('LDAP sync job scheduled', {
    schedule: cronExpression,
    timezone: 'Asia/Seoul',
    description: 'Daily at 2:00 AM',
  });
}

/**
 * Run sync job immediately (for testing)
 */
export async function runSyncJobNow() {
  if (isJobRunning) {
    throw new Error('LDAP sync job is already running');
  }

  try {
    isJobRunning = true;
    appLogger.info('Running LDAP sync job manually');

    const result = await ldapSyncService.syncFromLdap(false);
    return result;
  } finally {
    isJobRunning = false;
  }
}
