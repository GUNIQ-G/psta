import { Router, RequestHandler } from 'express';
import * as itemController from '../controllers/item.controller';
import { authMiddleware } from '../middleware/auth';
import { uploadItemImage } from '../config/multer';
import { query, queryOne } from '../config/database';

const router = Router();

router.use(authMiddleware as RequestHandler);

router.get('/', itemController.getItems as RequestHandler);
router.get('/tree', itemController.getItemTree as RequestHandler);
router.post('/upload-image', uploadItemImage.single('image'), itemController.uploadItemImage as RequestHandler);
router.get('/images/:filename', itemController.getItemImage as RequestHandler);

// Test endpoint to check _count for specific item
router.get('/test-count', async (req: any, res: any) => {
  const item = await queryOne<{ id: string; name: string }>(
    `SELECT "id", "name" FROM "Item" WHERE "id" = $1`,
    ['ccf06ea3-e1c0-42e3-a8bf-6a73b94dd3a0']
  );

  if (!item) {
    return res.json({ itemName: null, hasCountField: false, countValue: null, fullItem: null });
  }

  const [commentCount, fileCount, linkCount] = await Promise.all([
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "Comment" WHERE "itemId" = $1`,
      [item.id]
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "File" WHERE "itemId" = $1`,
      [item.id]
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "Link" WHERE "itemId" = $1`,
      [item.id]
    ),
  ]);

  const countValue = {
    Comment: commentCount?.count ?? 0,
    File: fileCount?.count ?? 0,
    Link: linkCount?.count ?? 0,
  };

  res.json({
    itemName: item.name,
    hasCountField: true,
    countValue,
    fullItem: { ...item, _count: countValue },
  });
});

router.get('/:id', itemController.getItemById as RequestHandler);
router.post('/', itemController.createItem as RequestHandler);
router.put('/:id', itemController.updateItem as RequestHandler);
router.patch('/:id/move', itemController.moveItem as RequestHandler);
router.delete('/:id', itemController.deleteItem as RequestHandler);

export default router;
