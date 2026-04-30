// src/routes/reviews.js
import express from 'express';
import supabase from '../supabase.js';

const router = express.Router();

// Get reviews for a specific property
router.get('/property/:propertyId', async (req, res) => {
  const { propertyId } = req.params;

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('property_id', propertyId);

    if (error) {
      console.error('Error fetching reviews:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`Found ${data?.length || 0} reviews for property ${propertyId}`);
    res.json(data || []);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;