// src/routes/reviews.js
import express from 'express';
import supabase from '../supabase.js';

const router = express.Router();

// Get reviews for a property
router.get('/property/:propertyId', async (req, res) => {
  const { propertyId } = req.params;

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      review_id,
      rating,
      comment,
      created_at,
      guest:guest_id (
        full_name,
        email
      )
    `)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  
  // Format the response
  const formattedReviews = data.map(review => ({
    review_id: review.review_id,
    rating: review.rating,
    comment: review.comment,
    created_at: review.created_at,
    guest_name: review.guest?.full_name || 'Anonymous'
  }));
  
  res.json(formattedReviews);
});

export default router;