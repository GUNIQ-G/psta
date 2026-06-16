import { Router, RequestHandler } from 'express';
import * as itemController from '../controllers/item.controller';
import { authMiddleware } from '../middleware/auth';
import { uploadItemImage } from '../config/multer';

const router = Router();

router.use(authMiddleware as RequestHandler);

router.get('/', itemController.getItems as RequestHandler);
router.get('/tree', itemController.getItemTree as RequestHandler);
router.post('/upload-image', uploadItemImage.single('image'), itemController.uploadItemImage as RequestHandler);
router.get('/images/:filename', itemController.getItemImage as RequestHandler);

// Test endpoint to check _count for specific item
router.get('/test-count', async (req: any, res: any) => {
  const prisma = (await import('../config/database')).default;

  const item = await prisma.item.findUnique({
    where: { id: 'ccf06ea3-e1c0-42e3-a8bf-6a73b94dd3a0' },
    include: {
      _count: {
        select: {
          Comment: true,
          File: true,
          Link: true,
        },
      },
    },
  });

  res.json({
    itemName: item?.name,
    hasCountField: '_count' in (item || {}),
    countValue: item?._count,
    fullItem: item,
  });
});
router.get('/:id', itemController.getItemById as RequestHandler);
router.post('/', itemController.createItem as RequestHandler);
router.put('/:id', itemController.updateItem as RequestHandler);
router.patch('/:id/move', itemController.moveItem as RequestHandler);
router.delete('/:id', itemController.deleteItem as RequestHandler);

export default router;