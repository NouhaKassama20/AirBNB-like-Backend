import express from 'express';
import {
  getProperties,
  getPropertyById,
  getAllOffers
} from '../controllers/propertiesController.js';

const router = express.Router();

router.get('/', getProperties);
router.get('/offers/all', getAllOffers);  // ⚠️ must be BEFORE /:id
router.get('/:id', getPropertyById);

export default router;