import { useSQLite, sqliteClient } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Deduplication Module
 *
 * Generic deduplication functions for workflows to track and filter
 * already-processed items. Works with any table and ID column.
 */

export async function filterProcessed(params: {
  tableName: string;
  idColumn: string;
  idsToCheck: string[];
}): Promise<string[]> {
  const { tableName, idColumn, idsToCheck } = params;

  if (!idsToCheck || idsToCheck.length === 0) {
    logger.info('No IDs to check for deduplication');
    return [];
  }

  logger.info(
    { tableName, idColumn, count: idsToCheck.length },
    'Checking for already-processed items'
  );

  try {
    if (!useSQLite || !sqliteClient) {
      throw new Error('PostgreSQL support not yet implemented for deduplication module');
    }

    const placeholders = idsToCheck.map(() => '?').join(',');
    const queryStr = `SELECT DISTINCT ${idColumn} FROM ${tableName} WHERE ${idColumn} IN (${placeholders})`;

    const result = sqliteClient.prepare(queryStr).all(...idsToCheck) as Record<string, unknown>[];
    const existingIds = new Set(result.map(row => String(row[idColumn])));
    const newIds = idsToCheck.filter(id => !existingIds.has(id));

    logger.info(
      {
        tableName,
        totalChecked: idsToCheck.length,
        alreadyProcessed: existingIds.size,
        newItems: newIds.length,
      },
      'Deduplication complete'
    );

    return newIds;
  } catch (error) {
    logger.error({ error, tableName, idColumn }, 'Deduplication failed');
    throw new Error(
      `Failed to check duplicates in ${tableName}.${idColumn}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function hasProcessed(params: {
  tableName: string;
  idColumn: string;
  idToCheck: string;
}): Promise<boolean> {
  const { tableName, idColumn, idToCheck } = params;

  logger.info({ tableName, idColumn, idToCheck }, 'Checking if item already processed');

  try {
    if (!useSQLite || !sqliteClient) {
      throw new Error('PostgreSQL support not yet implemented for deduplication module');
    }

    const queryStr = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${idColumn} = ?`;
    const result = sqliteClient.prepare(queryStr).get(idToCheck) as { count: number } | undefined;
    const count = result?.count || 0;

    logger.info({ tableName, idColumn, idToCheck, exists: count > 0 }, 'Processed check complete');
    return count > 0;
  } catch (error) {
    logger.error({ error, tableName, idColumn }, 'Processed check failed');
    throw new Error(
      `Failed to check if processed in ${tableName}.${idColumn}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function filterProcessedItems<T extends Record<string, unknown>>(params: {
  items: T[];
  tableName: string;
  idColumn: string;
  itemIdField: string;
}): Promise<T[]> {
  const { items, tableName, idColumn, itemIdField } = params;

  if (!items || items.length === 0) {
    return [];
  }

  const idsToCheck = items.map(item => String(item[itemIdField]));
  const newIds = await filterProcessed({ tableName, idColumn, idsToCheck });
  const newIdsSet = new Set(newIds);

  const filteredItems = items.filter(item => newIdsSet.has(String(item[itemIdField])));

  logger.info(
    {
      tableName,
      totalItems: items.length,
      filteredItems: filteredItems.length,
    },
    'Filtered processed items'
  );

  return filteredItems;
}

export async function markAsProcessed(params: {
  tableName: string;
  record: Record<string, unknown>;
}): Promise<void> {
  const { tableName, record } = params;

  logger.info({ tableName, record }, 'Marking item as processed');

  try {
    if (!useSQLite || !sqliteClient) {
      throw new Error('PostgreSQL support not yet implemented for deduplication module');
    }

    const columns = Object.keys(record).join(', ');
    const placeholders = Object.keys(record).map(() => '?').join(', ');
    const queryStr = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;

    sqliteClient.prepare(queryStr).run(...Object.values(record));

    logger.info({ tableName }, 'Item marked as processed');
  } catch (error) {
    logger.error({ error, tableName }, 'Failed to mark as processed');
    throw new Error(
      `Failed to mark as processed in ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * In-Memory Deduplication Functions
 *
 * These functions perform deduplication on arrays of objects in memory,
 * without requiring database access.
 */

export async function deduplicateBy<T extends Record<string, unknown>>(params: {
  items: T[];
  field: string;
}): Promise<T[]> {
  const { items, field } = params;

  if (!items || items.length === 0) {
    return [];
  }

  logger.info({ count: items.length, field }, 'Deduplicating items by field');

  const seen = new Set<unknown>();
  const unique: T[] = [];

  for (const item of items) {
    const value = item[field];

    if (!seen.has(value)) {
      seen.add(value);
      unique.push(item);
    }
  }

  logger.info(
    {
      originalCount: items.length,
      uniqueCount: unique.length,
      duplicatesRemoved: items.length - unique.length,
    },
    'Deduplication by field complete'
  );

  return unique;
}

export async function deduplicateByMultiple<T extends Record<string, unknown>>(params: {
  items: T[];
  fields: string[];
}): Promise<T[]> {
  const { items, fields } = params;

  if (!items || items.length === 0) {
    return [];
  }

  if (!fields || fields.length === 0) {
    throw new Error('At least one field must be specified for deduplication');
  }

  logger.info({ count: items.length, fields }, 'Deduplicating items by multiple fields');

  const seen = new Set<string>();
  const unique: T[] = [];

  for (const item of items) {
    // Create composite key from all fields
    const keyParts = fields.map(field => {
      const value = item[field];
      return value === null || value === undefined ? 'null' : String(value);
    });
    const compositeKey = keyParts.join('|');

    if (!seen.has(compositeKey)) {
      seen.add(compositeKey);
      unique.push(item);
    }
  }

  logger.info(
    {
      originalCount: items.length,
      uniqueCount: unique.length,
      duplicatesRemoved: items.length - unique.length,
    },
    'Deduplication by multiple fields complete'
  );

  return unique;
}

export async function findDuplicates<T extends Record<string, unknown>>(params: {
  items: T[];
  field: string;
}): Promise<T[]> {
  const { items, field } = params;

  if (!items || items.length === 0) {
    return [];
  }

  logger.info({ count: items.length, field }, 'Finding duplicate items by field');

  const valueToItems = new Map<unknown, T[]>();

  // Group items by field value
  for (const item of items) {
    const value = item[field];

    if (!valueToItems.has(value)) {
      valueToItems.set(value, []);
    }
    valueToItems.get(value)!.push(item);
  }

  // Collect items that appear more than once
  const duplicates: T[] = [];
  for (const items of valueToItems.values()) {
    if (items.length > 1) {
      duplicates.push(...items);
    }
  }

  logger.info(
    {
      totalItems: items.length,
      duplicateItems: duplicates.length,
      uniqueValues: valueToItems.size,
    },
    'Find duplicates complete'
  );

  return duplicates;
}

export async function excludeByIds<T extends Record<string, unknown>>(params: {
  items: T[];
  excludeIds: unknown[];
  idField: string;
}): Promise<T[]> {
  const { items, excludeIds, idField } = params;

  if (!items || items.length === 0) {
    return [];
  }

  if (!excludeIds || excludeIds.length === 0) {
    return items;
  }

  logger.info(
    { itemCount: items.length, excludeCount: excludeIds.length, idField },
    'Excluding items by ID list'
  );

  const excludeSet = new Set(excludeIds);
  const filtered = items.filter(item => !excludeSet.has(item[idField]));

  logger.info(
    {
      originalCount: items.length,
      excludedCount: items.length - filtered.length,
      remainingCount: filtered.length,
    },
    'Exclude by IDs complete'
  );

  return filtered;
}

export async function uniqueValues<T extends Record<string, unknown>>(params: {
  items: T[];
  field: string;
}): Promise<unknown[]> {
  const { items, field } = params;

  if (!items || items.length === 0) {
    return [];
  }

  logger.info({ count: items.length, field }, 'Extracting unique values for field');

  const values = new Set<unknown>();

  for (const item of items) {
    values.add(item[field]);
  }

  const uniqueArray = Array.from(values);

  logger.info(
    {
      totalItems: items.length,
      uniqueValues: uniqueArray.length,
    },
    'Unique values extraction complete'
  );

  return uniqueArray;
}
