import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);


// adminDashboard Route
import adminRouter from './routes/admin.js'
app.use('/api/admin', adminRouter)



// ─── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


