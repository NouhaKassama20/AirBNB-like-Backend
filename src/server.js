import express from 'express'
import dotenv from 'dotenv'
import propertiesRouter from './routes/properties.js'
import bookingsRouter  from './routes/bookings.js'
import cors from 'cors'
import authRoutes from './routes/authRoutes.js';


dotenv.config();


const app = express()
app.use(cors())
app.use(express.json())



app.use('/api/properties', propertiesRouter)
app.use('/api/bookings',   bookingsRouter)
app.get('/', (req, res) => {
  res.json({ message: 'API is running' })
})

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
// ─── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));


const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})





