import { Router, Request, Response, NextFunction } from 'express';
import { getWorkspaceTasks } from '../db/helpers';

const router = Router();

// GET /api/workspace/tasks?assigneeId=&status=&projectId=
router.get('/workspace/tasks', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assigneeId, status, projectId } = req.query as Record<string, string>;
    return res.json(getWorkspaceTasks({ assigneeId, status, projectId }));
  } catch (err) { next(err); }
});

export default router;
