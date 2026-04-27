// src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
// adminDashboard Route
import adminRouter from './routes/admin.js'


// Keep your other routes too if you want them
import propertiesRouter from './routes/properties.js';
import bookingsRouter from './routes/bookings.js';
import hostsRouter from './routes/hosts.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration (merged from both versions)
app.use(cors({ 
  origin: process.env.CLIENT_URL || 'http://localhost:5173', 
  credentials: true 
}));
app.use(express.json());

// All route handlers
app.use('/api/auth', authRoutes);           // NEW: auth routes
app.use('/api/properties', propertiesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/hosts', hostsRouter);          // NEW: hosts routes

// Health check endpoint (from first version)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Root endpoint (from second version)
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
