// src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import adminRouter from './routes/admin.js'
import bookingsRouter from './routes/bookings.js';
import hostsRouter from './routes/hosts.js';
import hostPropertiesRouter from './routes/hostProperties.js';
import { uploadImages, uploadVideo, handleImageUpload, handleVideoUpload } from './controllers/uploadController.js';
import reviewsRouter from './routes/reviews.js';
import propertiesRouter from './routes/properties.js';
import guestRouter from './routes/guests.js';
import wishlistRoutes from './routes/wishlist.js';
import messageRoutes from './routes/messageRoutes.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration
app.use(cors({ 
  origin: process.env.CLIENT_URL || 'http://localhost:5173', 
  credentials: true 
}));

// Increase payload size limits for image/video uploads
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// Serve static files (uploaded images and videos)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Upload routes - place this BEFORE other routes
app.post('/api/upload/property-images', uploadImages.array('images', 10), handleImageUpload);
app.post('/api/upload/property-video', uploadVideo.single('video'), handleVideoUpload);

// All route handlers
app.use('/api/auth', authRoutes); 
app.use('/api/reviews', reviewsRouter); 
app.use('/api/properties', propertiesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/hosts', hostsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/host/properties', hostPropertiesRouter);
app.use('/api/guests', guestRouter);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api', reviewsRouter);
app.use('/api/messages', messageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Add this profile image upload endpoint
app.post('/api/upload/profile-image', uploadImages.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/properties/${req.file.filename}`;
    
    res.json({ success: true, imageUrl: imageUrl });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});


