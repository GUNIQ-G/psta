import { Router, RequestHandler } from 'express';
import * as permissionController from '../controllers/permission.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 모든 라우트에 인증 필요
router.use(authMiddleware as RequestHandler);

// 현재 사용자의 권한 조회 (가장 자주 사용됨)
router.get('/my', permissionController.getMyPermissions as RequestHandler);

// 역할별 권한 조회
router.get('/role/:role', permissionController.getPermissionsByRole as RequestHandler);

// 모든 권한 조회 (ADMIN only)
router.get('/', permissionController.getPermissions as RequestHandler);

// 개별 권한 업데이트 (ADMIN only)
router.put('/:id', permissionController.updatePermission as RequestHandler);

// 역할별 권한 일괄 업데이트 (ADMIN only)
router.put('/role/:role/bulk', permissionController.updateRolePermissions as RequestHandler);

export default router;
