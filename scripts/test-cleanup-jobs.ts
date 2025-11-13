#!/usr/bin/env tsx
/**
 * Test script for data retention cleanup jobs
 *
 * This script tests all cleanup jobs by:
 * 1. Creating test data with various ages
 * 2. Running each cleanup job
 * 3. Verifying correct records were deleted
 * 4. Cleaning up test data
 *
 * Usage: npx tsx scripts/test-cleanup-jobs.ts
 */

import { db } from '../src/lib/db';
import {
  workflowsTable,
  workflowRunsTable,
  chatConversationsTable,
  chatMessagesTable,
  jobLogsTable,
  tweetRepliesTable,
  invitationsTable,
  usersTable,
  organizationsTable,
} from '../src/lib/schema';
import {
  cleanupWorkflowRuns,
  cleanupChatMessages,
  cleanupJobLogs,
  cleanupTweetReplies,
  cleanupInvitations,
} from '../src/lib/jobs';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const TEST_USER_ID = 'test-cleanup-user-' + Date.now();
const TEST_ORG_ID = 'test-cleanup-org-' + Date.now();
const TEST_WORKFLOW_ID = 'test-cleanup-workflow-' + Date.now();

async function createTestData() {
  console.log('\n📝 Creating test data...\n');

  // Create test user
  await db.insert(usersTable).values({
    id: TEST_USER_ID,
    email: `test-cleanup-${Date.now()}@example.com`,
    password: 'test-password-hash',
    name: 'Test Cleanup User',
  });

  // Create test organization
  await db.insert(organizationsTable).values({
    id: TEST_ORG_ID,
    name: 'Test Cleanup Org',
    slug: `test-cleanup-org-${Date.now()}`,
    ownerId: TEST_USER_ID,
    status: 'active',
  });

  // Create test workflow
  await db.insert(workflowsTable).values({
    id: TEST_WORKFLOW_ID,
    userId: TEST_USER_ID,
    name: 'Test Cleanup Workflow',
    description: 'Test workflow for cleanup jobs',
    prompt: 'Test prompt',
    status: 'active',
    trigger: { type: 'manual', config: {} },
    config: { steps: [] },
  });

  const now = Date.now();
  const thirtyOneDaysAgo = new Date(now - 31 * 24 * 60 * 60 * 1000);
  const ninetyOneDaysAgo = new Date(now - 91 * 24 * 60 * 60 * 1000);
  const recent = new Date(now - 1 * 24 * 60 * 60 * 1000);

  // Create workflow runs (should delete old successful, keep recent and old failed)
  const runs = [
    { id: randomUUID(), status: 'success', date: thirtyOneDaysAgo, shouldDelete: true },
    { id: randomUUID(), status: 'success', date: recent, shouldDelete: false },
    { id: randomUUID(), status: 'error', date: ninetyOneDaysAgo, shouldDelete: true },
    { id: randomUUID(), status: 'error', date: recent, shouldDelete: false },
  ];

  for (const run of runs) {
    await db.insert(workflowRunsTable).values({
      id: run.id,
      workflowId: TEST_WORKFLOW_ID,
      userId: TEST_USER_ID,
      status: run.status as 'success' | 'error',
      startedAt: run.date,
      completedAt: run.date,
      triggerType: 'manual',
      output: 'Test output',
    });
  }

  console.log(`✓ Created ${runs.length} workflow runs`);

  // Create chat conversations and messages
  const conversationId = randomUUID();
  await db.insert(chatConversationsTable).values({
    id: conversationId,
    workflowId: TEST_WORKFLOW_ID,
    userId: TEST_USER_ID,
    status: 'active',
    title: 'Test Conversation',
    createdAt: recent,
    updatedAt: recent,
  });

  // Create 150 messages (should keep last 100)
  const messages = [];
  for (let i = 0; i < 150; i++) {
    messages.push({
      id: randomUUID(),
      conversationId,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Test message ${i}`,
      createdAt: new Date(now - (150 - i) * 60 * 1000), // Each message 1 minute apart
    });
  }

  await db.insert(chatMessagesTable).values(messages);
  console.log(`✓ Created ${messages.length} chat messages`);

  // Create job logs (should delete old ones)
  const logs = [
    { date: thirtyOneDaysAgo, shouldDelete: true },
    { date: recent, shouldDelete: false },
  ];

  for (const log of logs) {
    await db.insert(jobLogsTable).values({
      jobName: 'test-job',
      status: 'success',
      message: 'Test log',
      createdAt: log.date,
    });
  }

  console.log(`✓ Created ${logs.length} job logs`);

  // Create tweet replies (should delete old ones)
  const tweets = [
    { date: ninetyOneDaysAgo, shouldDelete: true },
    { date: recent, shouldDelete: false },
  ];

  for (const tweet of tweets) {
    await db.insert(tweetRepliesTable).values({
      originalTweetId: `test-tweet-${Date.now()}-${Math.random()}`,
      originalTweetText: 'Test tweet',
      originalTweetAuthor: 'test_author',
      ourReplyText: 'Test reply',
      ourReplyTweetId: `reply-${Date.now()}`,
      userId: TEST_USER_ID,
      status: 'replied',
      createdAt: tweet.date,
    });
  }

  console.log(`✓ Created ${tweets.length} tweet replies`);

  // Create invitations (should delete expired ones)
  const thirtyOneDaysAfterExpiry = new Date(now - 61 * 24 * 60 * 60 * 1000); // Expired 61 days ago
  const recentExpiry = new Date(now + 7 * 24 * 60 * 60 * 1000); // Expires in 7 days

  const invitations = [
    { expiresAt: thirtyOneDaysAfterExpiry, shouldDelete: true },
    { expiresAt: recentExpiry, shouldDelete: false },
  ];

  for (const invite of invitations) {
    await db.insert(invitationsTable).values({
      id: randomUUID(),
      token: randomUUID(),
      email: `test-invite-${Date.now()}@example.com`,
      organizationId: TEST_ORG_ID,
      role: 'member',
      invitedBy: TEST_USER_ID,
      expiresAt: invite.expiresAt,
    });
  }

  console.log(`✓ Created ${invitations.length} invitations\n`);

  return { runs, messages, logs, tweets, invitations };
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...\n');

  // Delete in correct order due to foreign keys
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.conversationId,
    (await db.select({ id: chatConversationsTable.id })
      .from(chatConversationsTable)
      .where(eq(chatConversationsTable.workflowId, TEST_WORKFLOW_ID)))[0]?.id || ''
  ));

  await db.delete(chatConversationsTable).where(eq(chatConversationsTable.workflowId, TEST_WORKFLOW_ID));
  await db.delete(workflowRunsTable).where(eq(workflowRunsTable.workflowId, TEST_WORKFLOW_ID));
  await db.delete(workflowsTable).where(eq(workflowsTable.id, TEST_WORKFLOW_ID));
  await db.delete(organizationsTable).where(eq(organizationsTable.id, TEST_ORG_ID));
  await db.delete(usersTable).where(eq(usersTable.id, TEST_USER_ID));

  // Clean up test job logs and tweet replies
  await db.delete(jobLogsTable).where(eq(jobLogsTable.jobName, 'test-job'));
  await db.delete(tweetRepliesTable).where(eq(tweetRepliesTable.userId, TEST_USER_ID));
  await db.delete(invitationsTable).where(eq(invitationsTable.organizationId, TEST_ORG_ID));

  console.log('✓ Test data cleaned up\n');
}

async function testCleanupJobs() {
  console.log('🧪 Testing Database Cleanup Jobs\n');
  console.log('='.repeat(50));

  try {
    const testData = await createTestData();

    // Test 1: Workflow Runs Cleanup
    console.log('1️⃣  Testing workflow runs cleanup...');
    const runsBeforeCleanup = await db.select().from(workflowRunsTable).where(eq(workflowRunsTable.workflowId, TEST_WORKFLOW_ID));
    console.log(`   Before: ${runsBeforeCleanup.length} workflow runs`);

    await cleanupWorkflowRuns();

    const runsAfterCleanup = await db.select().from(workflowRunsTable).where(eq(workflowRunsTable.workflowId, TEST_WORKFLOW_ID));
    console.log(`   After: ${runsAfterCleanup.length} workflow runs`);

    const expectedRemaining = testData.runs.filter(r => !r.shouldDelete).length;
    if (runsAfterCleanup.length === expectedRemaining) {
      console.log(`   ✅ PASS - Correctly deleted old runs (expected ${expectedRemaining}, got ${runsAfterCleanup.length})\n`);
    } else {
      console.log(`   ❌ FAIL - Expected ${expectedRemaining} remaining, got ${runsAfterCleanup.length}\n`);
    }

    // Test 2: Chat Messages Cleanup
    console.log('2️⃣  Testing chat messages cleanup...');
    const conversationId = (await db.select({ id: chatConversationsTable.id })
      .from(chatConversationsTable)
      .where(eq(chatConversationsTable.workflowId, TEST_WORKFLOW_ID)))[0]?.id;

    const messagesBeforeCleanup = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.conversationId, conversationId));
    console.log(`   Before: ${messagesBeforeCleanup.length} messages`);

    await cleanupChatMessages();

    const messagesAfterCleanup = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.conversationId, conversationId));
    console.log(`   After: ${messagesAfterCleanup.length} messages`);

    if (messagesAfterCleanup.length === 100) {
      console.log(`   ✅ PASS - Kept last 100 messages\n`);
    } else {
      console.log(`   ❌ FAIL - Expected 100 messages, got ${messagesAfterCleanup.length}\n`);
    }

    // Test 3: Job Logs Cleanup
    console.log('3️⃣  Testing job logs cleanup...');
    const logsBeforeCleanup = await db.select().from(jobLogsTable).where(eq(jobLogsTable.jobName, 'test-job'));
    console.log(`   Before: ${logsBeforeCleanup.length} job logs`);

    await cleanupJobLogs();

    const logsAfterCleanup = await db.select().from(jobLogsTable).where(eq(jobLogsTable.jobName, 'test-job'));
    console.log(`   After: ${logsAfterCleanup.length} job logs`);

    const expectedLogs = testData.logs.filter(l => !l.shouldDelete).length;
    if (logsAfterCleanup.length === expectedLogs) {
      console.log(`   ✅ PASS - Correctly deleted old logs\n`);
    } else {
      console.log(`   ❌ FAIL - Expected ${expectedLogs} logs, got ${logsAfterCleanup.length}\n`);
    }

    // Test 4: Tweet Replies Cleanup
    console.log('4️⃣  Testing tweet replies cleanup...');
    const tweetsBeforeCleanup = await db.select().from(tweetRepliesTable).where(eq(tweetRepliesTable.userId, TEST_USER_ID));
    console.log(`   Before: ${tweetsBeforeCleanup.length} tweet replies`);

    await cleanupTweetReplies();

    const tweetsAfterCleanup = await db.select().from(tweetRepliesTable).where(eq(tweetRepliesTable.userId, TEST_USER_ID));
    console.log(`   After: ${tweetsAfterCleanup.length} tweet replies`);

    const expectedTweets = testData.tweets.filter(t => !t.shouldDelete).length;
    if (tweetsAfterCleanup.length === expectedTweets) {
      console.log(`   ✅ PASS - Correctly deleted old tweet replies\n`);
    } else {
      console.log(`   ❌ FAIL - Expected ${expectedTweets} tweets, got ${tweetsAfterCleanup.length}\n`);
    }

    // Test 5: Invitations Cleanup
    console.log('5️⃣  Testing invitations cleanup...');
    const invitesBeforeCleanup = await db.select().from(invitationsTable).where(eq(invitationsTable.organizationId, TEST_ORG_ID));
    console.log(`   Before: ${invitesBeforeCleanup.length} invitations`);

    await cleanupInvitations();

    const invitesAfterCleanup = await db.select().from(invitationsTable).where(eq(invitationsTable.organizationId, TEST_ORG_ID));
    console.log(`   After: ${invitesAfterCleanup.length} invitations`);

    const expectedInvites = testData.invitations.filter(i => !i.shouldDelete).length;
    if (invitesAfterCleanup.length === expectedInvites) {
      console.log(`   ✅ PASS - Correctly deleted expired invitations\n`);
    } else {
      console.log(`   ❌ FAIL - Expected ${expectedInvites} invitations, got ${invitesAfterCleanup.length}\n`);
    }

    await cleanupTestData();

    console.log('='.repeat(50));
    console.log('✅ All cleanup job tests completed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    await cleanupTestData();
    process.exit(1);
  }
}

// Run tests
testCleanupJobs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
