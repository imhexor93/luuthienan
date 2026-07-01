import { Router, Request, Response, NextFunction } from 'express';
import { getDashboardStats, searchAll, getActivitiesByProject, getRDOverview } from '../db/helpers';

const router = Router();

// GET /api/dashboard/stats
router.get('/dashboard/stats', (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getDashboardStats());
  } catch (err) { next(err); }
});

// GET /api/dashboard/rd-overview
router.get('/dashboard/rd-overview', (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getRDOverview());
  } catch (err) { next(err); }
});

// GET /api/search?q=...
router.get('/search', (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) ?? '';
    if (!q || q.trim().length < 2) {
      return res.json({ projects: [], tasks: [] });
    }
    return res.json(searchAll(q.trim()));
  } catch (err) { next(err); }
});

// GET /api/projects/:projectId/activities
router.get('/projects/:projectId/activities', (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const activities = getActivitiesByProject(req.params.projectId, page);
    return res.json(activities);
  } catch (err) { next(err); }
});

export default router;
