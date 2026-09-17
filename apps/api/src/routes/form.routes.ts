import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { createFormSchema, updateFormSchema } from '@ngb/shared';
import * as formService from '../services/form.service.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/forms — List all forms
 */
router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const forms = await formService.listForms();
    res.json({ success: true, data: forms });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/forms — Create a new form
 */
router.post('/', validateBody(createFormSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = await formService.createForm(req.body);
    res.status(201).json({ success: true, data: form });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/forms/:id — Get a form by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = await formService.getForm(req.params.id);
    res.json({ success: true, data: form });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/forms/:id — Update a form
 */
router.put('/:id', validateBody(updateFormSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = await formService.updateForm(req.params.id, req.body);
    res.json({ success: true, data: form });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/forms/:id/publish — Publish form version
 * Supports applying to all domains
 */
router.post('/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applyToAllDomains = Boolean(req.body?.applyToAllDomains);
    const result = await formService.publishForm(req.params.id, applyToAllDomains);
    res.json({
      success: true,
      data: result,
      message: applyToAllDomains
        ? 'Form published and successfully applied to all domains!'
        : 'Form published successfully!',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/forms/:id — Delete / archive form
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await formService.deleteForm(req.params.id);
    res.json({ success: true, message: 'Form deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export { router as formRoutes };
