// src/routes/authRoutes.js
import express from 'express';
import { hostSignup, hostLogin, logout } from '../controllers/authController.js';

const router = express.Router();

router.post('/host/signup', hostSignup);
router.post('/host/login',  hostLogin);
router.post('/logout',      logout);

export default router;