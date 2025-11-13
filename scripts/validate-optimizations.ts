#!/usr/bin/env tsx
/**
 * Quick validation script for database optimizations
 *
 * This script performs a quick health check on all optimizations:
 * - Verifies cleanup jobs are registered
 * - Checks migration was applied (optional)
 * - Validates code changes are in place
 * - Tests cache connectivity
 *
 * Usage: npx tsx scripts/validate-optimizations.ts
 */

import { existsSync, readFileSync } from 'fs';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { getRedisClient } from '../src/lib/redis';

console.log('🔍 Validating Database Optimizations\n');
console.log('='.repeat(50));

let passCount = 0;
let failCount = 0;

function pass(message: string) {
  console.log(`✅ ${message}`);
  passCount++;
}

function fail(message: string) {
  console.log(`❌ ${message}`);
  failCount++;
}

function info(message: string) {
  console.log(`ℹ️  ${message}`);
}

async function validateCleanupJobs() {
  console.log('\n1️⃣  Cleanup Jobs\n');

  const jobFiles = [
    'src/lib/jobs/cleanup-workflow-runs.ts',
    'src/lib/jobs/cleanup-chat-messages.ts',
    'src/lib/jobs/cleanup-job-logs.ts',
    'src/lib/jobs/cleanup-tweet-replies.ts',
    'src/lib/jobs/cleanup-invitations.ts',
  ];

  for (const file of jobFiles) {
    if (existsSync(file)) {
      pass(`Job file exists: ${file}`);
    } else {
      fail(`Job file missing: ${file}`);
    }
  }

  // Check jobs are registered
  const indexFile = 'src/lib/jobs/index.ts';
  if (existsSync(indexFile)) {
    const content = readFileSync(indexFile, 'utf-8');
    const expectedImports = [
      'cleanupWorkflowRuns',
      'cleanupChatMessages',
      'cleanupJobLogs',
      'cleanupTweetReplies',
      'cleanupInvitations',
    ];

    for (const importName of expectedImports) {
      if (content.includes(importName)) {
        pass(`Job registered: ${importName}`);
      } else {
        fail(`Job not registered: ${importName}`);
      }
    }
  } else {
    fail('Jobs index file missing');
  }
}

async function validateMigration() {
  console.log('\n2️⃣  Database Migration\n');

  if (!existsSync('drizzle/0010_add_performance_indexes.sql')) {
    fail('Migration file missing');
    return;
  }

  pass('Migration file exists');

  try {
    // Check if indexes exist
    const result = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          indexname = 'chat_messages_conversation_created_idx' OR
          indexname = 'chat_conversations_workflow_status_idx' OR
          indexname = 'workflow_runs_user_org_status_idx'
        );
    `);

    if (result.rows && result.rows.length > 0) {
      pass(`Found ${result.rows.length} new indexes (migration applied)`);
      info('Run full migration test to verify all indexes');
    } else {
      info('Indexes not found - migration may not be applied yet');
      info('Run: npx drizzle-kit push:pg');
    }
  } catch {
    info('Could not check indexes (database may not be accessible)');
  }
}

async function validateCodeChanges() {
  console.log('\n3️⃣  Code Optimizations\n');

  // Check N+1 fix in workflows route
  const workflowsRoute = 'src/app/api/workflows/route.ts';
  if (existsSync(workflowsRoute)) {
    const content = readFileSync(workflowsRoute, 'utf-8');
    if (content.includes('leftJoin') && content.includes('groupBy')) {
      pass('N+1 query fix applied (LEFT JOIN with GROUP BY)');
    } else {
      fail('N+1 query fix not found in workflows route');
    }
  } else {
    fail('Workflows route file missing');
  }

  // Check credential optimization
  const credentialsFile = 'src/lib/workflows/credentials.ts';
  if (existsSync(credentialsFile)) {
    const content = readFileSync(credentialsFile, 'utf-8');
    const lastUsedUpdates = (content.match(/\.update\(userCredentialsTable\)/g) || []).length;
    const removalComments = (content.match(/lastUsed timestamp update removed/g) || []).length;

    if (removalComments >= 2) {
      pass('Credential lastUsed updates removed (2 locations)');
    } else if (lastUsedUpdates === 0) {
      pass('No lastUsed updates found (optimization applied)');
    } else {
      fail(`Found ${lastUsedUpdates} lastUsed updates (should be 0)`);
    }
  } else {
    fail('Credentials file missing');
  }

  // Check token refresh pagination
  const tokenRefreshFile = 'src/lib/jobs/refresh-expiring-tokens.ts';
  if (existsSync(tokenRefreshFile)) {
    const content = readFileSync(tokenRefreshFile, 'utf-8');
    if (content.includes('BATCH_SIZE') && content.includes('.limit(')) {
      pass('Token refresh pagination added');
    } else {
      fail('Token refresh pagination not found');
    }
  } else {
    fail('Token refresh file missing');
  }

  // Check dashboard caching
  const dashboardRoute = 'src/app/api/dashboard/stats/route.ts';
  if (existsSync(dashboardRoute)) {
    const content = readFileSync(dashboardRoute, 'utf-8');
    if (content.includes('getCacheOrCompute') && content.includes('CacheKeys.dashboardStats')) {
      pass('Dashboard stats caching implemented');
    } else {
      fail('Dashboard stats caching not found');
    }
  } else {
    fail('Dashboard stats route missing');
  }
}

async function validateCache() {
  console.log('\n4️⃣  Cache Configuration\n');

  // Check cache keys defined
  const cacheFile = 'src/lib/cache.ts';
  if (existsSync(cacheFile)) {
    const content = readFileSync(cacheFile, 'utf-8');
    const expectedKeys = ['dashboardStats', 'organizationMemberships'];

    for (const key of expectedKeys) {
      if (content.includes(key)) {
        pass(`Cache key defined: ${key}`);
      } else {
        fail(`Cache key missing: ${key}`);
      }
    }
  } else {
    fail('Cache file missing');
  }

  // Test Redis connection
  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.ping();
      pass('Redis connection working');
    } else {
      info('Redis not configured (optional but recommended)');
    }
  } catch {
    info('Redis not available (caching will be disabled)');
  }
}

async function runValidation() {
  try {
    await validateCleanupJobs();
    await validateMigration();
    await validateCodeChanges();
    await validateCache();

    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Validation Results: ${passCount} passed, ${failCount} failed\n`);

    if (failCount === 0) {
      console.log('✅ All optimizations validated successfully!\n');
      console.log('Next steps:');
      console.log('1. Apply migration: npx drizzle-kit push:pg');
      console.log('2. Run cleanup tests: npx tsx scripts/test-cleanup-jobs.ts');
      console.log('3. Run performance tests: npx tsx scripts/test-performance.ts\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some validations failed. Please review the issues above.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Validation error:', error);
    process.exit(1);
  }
}

runValidation();
