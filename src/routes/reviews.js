// src/routes/reviews.js
import express from 'express';
import supabase from '../supabase.js';

const router = express.Router();

// Get reviews for a specific property
router.get('/properties/:propertyId/reviews', async (req, res) => {
  const { propertyId } = req.params;

  try {
    // First, get all reviews for this property
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      return res.status(500).json({ error: reviewsError.message });
    }

    if (!reviewsData || reviewsData.length === 0) {
      return res.json({ reviews: [] });
    }

    // Get unique guest IDs from reviews
    const guestIds = [...new Set(reviewsData.map(review => review.guest_id).filter(id => id))];
    
    if (guestIds.length === 0) {
      const formattedReviews = reviewsData.map(review => ({
        review_id: review.review_id,
        property_id: review.property_id,
        user_id: review.guest_id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        user_name: `Guest ${review.guest_id?.slice(0, 8)}`
      }));
      return res.json({ reviews: formattedReviews });
    }

    // Fetch guest/user information from the users table (or guests table)
    // Try multiple possible table names
    let usersData = [];
    
    // Try 'users' table first
    const { data: usersFromUsers, error: usersError } = await supabase
      .from('users')
      .select('user_id, full_name, email, username')
      .in('user_id', guestIds);
    
    if (!usersError && usersFromUsers) {
      usersData = usersFromUsers;
    } else {
      // Try 'guests' table if 'users' doesn't work
      const { data: guestsFromGuests, error: guestsError } = await supabase
        .from('guests')
        .select('guest_id, full_name, email, username')
        .in('guest_id', guestIds);
      
      if (!guestsError && guestsFromGuests) {
        usersData = guestsFromGuests.map(g => ({
          user_id: g.guest_id,
          full_name: g.full_name,
          email: g.email,
          username: g.username
        }));
      }
    }

    // Create a map of user_id to user data
    const userMap = new Map();
    usersData.forEach(user => {
      userMap.set(user.user_id, user);
    });

    // Format reviews with user information
    const formattedReviews = reviewsData.map(review => {
      const user = userMap.get(review.guest_id);
      return {
        review_id: review.review_id,
        property_id: review.property_id,
        user_id: review.guest_id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        user_name: user?.full_name || user?.username || `Guest ${review.guest_id?.slice(0, 8)}`,
        user_email: user?.email
      };
    });

    console.log(`Returning ${formattedReviews.length} reviews for property ${propertyId}`);
    res.json({ reviews: formattedReviews });
    
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Get average rating for a property
router.get('/properties/:propertyId/reviews/average', async (req, res) => {
  const { propertyId } = req.params;

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('property_id', propertyId);

    if (error) {
      console.error('Error calculating average:', error);
      return res.status(500).json({ error: error.message });
    }

    const average = data?.length > 0 
      ? data.reduce((sum, r) => sum + r.rating, 0) / data.length 
      : 0;
    
    res.json({ 
      averageRating: parseFloat(average.toFixed(1)),
      reviewCount: data?.length || 0
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add this test route at the top of your reviews.js (right after creating router)
router.get('/test', (req, res) => {
  res.json({ message: 'Reviews API is working!' });
});

router.post('/', async (req, res) => {
  console.log('📝 POST /api/reviews received');
  console.log('Request body:', req.body);
  
  // Accept both guest_id and user_id
  const { property_id, guest_id, user_id, rating, comment } = req.body;
  
  // Use whichever is provided (guest_id or user_id)
  const finalUserId = guest_id || user_id;

  // Validate input
  if (!property_id || !finalUserId || !rating || !comment) {
    console.log('❌ Missing fields:', { property_id, user_id: finalUserId, rating, comment });
    return res.status(400).json({ 
      error: 'Missing required fields: property_id, user_id, rating, comment' 
    });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    // Check if guest already reviewed this property
    const { data: existing, error: checkError } = await supabase
      .from('reviews')
      .select('review_id')
      .eq('property_id', property_id)
      .eq('guest_id', finalUserId)  // Use guest_id for the database query
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this property' });
    }

    // Insert new review
    const { data, error } = await supabase
      .from('reviews')
      .insert([
        { 
          property_id: property_id,
          guest_id: finalUserId,  // Use guest_id here too
          rating: rating,
          comment: comment,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error inserting review:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✅ Review added for property ${property_id} by guest ${finalUserId}`);
    res.status(201).json(data);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// src/routes/reviews.js
// The DELETE route is already there, but let me verify:

router.delete('/:reviewId', async (req, res) => {
  const { reviewId } = req.params;

  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('review_id', reviewId);

    if (error) {
      console.error('Error deleting review:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`Review ${reviewId} deleted`);
    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a review
router.delete('/:reviewId', async (req, res) => {
  const { reviewId } = req.params;

  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('review_id', reviewId);

    if (error) {
      console.error('Error deleting review:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`Review ${reviewId} deleted`);
    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;