import { query, queryOne } from '../config/database';
import { ItemStatus, ItemType } from '../types/enums';

/**
 * Calculate the status for a parent item based on its children
 * @param itemId The ID of the parent item
 * @returns The calculated status
 */
export async function calculateItemStatus(itemId: string): Promise<ItemStatus> {
  // Get the item
  const item = await queryOne<{ type: string; isOnHold: boolean }>(
    `SELECT "type", "isOnHold" FROM "Item" WHERE id = $1`,
    [itemId]
  );

  if (!item) {
    throw new Error(`Item ${itemId} not found`);
  }

  // ACTION items are always manually set, no calculation
  if (item.type === ItemType.ACTION) {
    // Return current status from DB
    const currentItem = await queryOne<{ status: ItemStatus }>(
      `SELECT "status" FROM "Item" WHERE id = $1`,
      [itemId]
    );
    return currentItem!.status;
  }

  // If isOnHold is checked, always return ON_HOLD
  if (item.isOnHold) {
    return ItemStatus.ON_HOLD;
  }

  // Get all direct children
  const children = await query<{ status: string; isOnHold: boolean }>(
    `SELECT "status", "isOnHold" FROM "Item" WHERE "parentId" = $1`,
    [itemId]
  );

  if (children.length === 0) {
    return ItemStatus.NOT_STARTED;
  }

  // Check if all children are COMPLETED
  const allCompleted = children.every(
    (child) => child.status === ItemStatus.COMPLETED && !child.isOnHold
  );
  if (allCompleted) {
    return ItemStatus.COMPLETED;
  }

  // Check if all children are NOT_STARTED
  const allNotStarted = children.every(
    (child) => child.status === ItemStatus.NOT_STARTED && !child.isOnHold
  );
  if (allNotStarted) {
    return ItemStatus.NOT_STARTED;
  }

  // Otherwise, it's IN_PROGRESS (mixed states or at least one in progress)
  return ItemStatus.IN_PROGRESS;
}

/**
 * Calculate the progress for a parent item based on its children
 * @param itemId The ID of the parent item
 * @returns The calculated progress (0-100)
 */
export async function calculateItemProgress(itemId: string): Promise<number> {
  // Get the item
  const item = await queryOne<{ type: string }>(
    `SELECT "type" FROM "Item" WHERE id = $1`,
    [itemId]
  );

  if (!item) {
    throw new Error(`Item ${itemId} not found`);
  }

  // ACTION items are always manually set, no calculation
  if (item.type === ItemType.ACTION) {
    const currentItem = await queryOne<{ progress: number }>(
      `SELECT "progress" FROM "Item" WHERE id = $1`,
      [itemId]
    );
    return currentItem!.progress;
  }

  // Get all direct children
  const children = await query<{ progress: number }>(
    `SELECT "progress" FROM "Item" WHERE "parentId" = $1`,
    [itemId]
  );

  if (children.length === 0) {
    return 0;
  }

  // Calculate average progress
  const totalProgress = children.reduce((sum, child) => sum + child.progress, 0);
  const averageProgress = totalProgress / children.length;

  // Round to 2 decimal places
  return Math.round(averageProgress * 100) / 100;
}

/**
 * Update item and all its parent chain with calculated status and progress
 * @param itemId The ID of the item to start updating from
 */
export async function updateItemAndParents(itemId: string): Promise<void> {
  // Get the item with current status and progress
  const item = await queryOne<{
    id: string;
    type: string;
    parentId: string | null;
    status: string;
    progress: number;
  }>(
    `SELECT "id", "type", "parentId", "status", "progress" FROM "Item" WHERE id = $1`,
    [itemId]
  );

  if (!item) {
    return;
  }

  // If this is an ACTION, don't update it (it's manual)
  // But still update its parents
  if (item.type !== ItemType.ACTION) {
    // Calculate status and progress
    const calculatedStatus = await calculateItemStatus(item.id);
    const calculatedProgress = await calculateItemProgress(item.id);

    // Only update if values have actually changed (optimize DB writes)
    const statusChanged = calculatedStatus !== item.status;
    const progressChanged = Math.abs(calculatedProgress - item.progress) > 0.01; // Account for floating point precision

    if (statusChanged || progressChanged) {
      await query(
        `UPDATE "Item" SET "status" = $1, "progress" = $2, "updatedAt" = $3 WHERE id = $4`,
        [calculatedStatus, calculatedProgress, new Date(), item.id]
      );

      console.log(`✓ Updated ${item.type} ${item.id}: status=${calculatedStatus}, progress=${calculatedProgress}`);
    } else {
      // Values unchanged, skip update
      console.log(`- Skipped ${item.type} ${item.id}: no changes`);
    }
  }

  // Recursively update parent if exists
  if (item.parentId) {
    await updateItemAndParents(item.parentId);
  }
}
