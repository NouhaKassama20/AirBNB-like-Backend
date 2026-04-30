// src/routes/properties.js
import express from 'express';
import supabase from '../supabase.js';

const router = express.Router();

// Get all properties with their reviews
router.get('/', async (req, res) => {
  try {
    const { data: properties, error } = await supabase
      .from('property')
      .select('*');

    if (error) {
      console.error('Error fetching properties:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`Found ${properties?.length || 0} properties`);

    if (!properties || properties.length === 0) {
      return res.json([]);
    }

    // Fetch reviews for each property
    const propertiesWithReviews = await Promise.all(
      properties.map(async (property) => {
        try {
          const { data: reviews, error: reviewError } = await supabase
            .from('reviews')
            .select('rating')
            .eq('property_id', property.property_id);

          if (reviewError) {
            console.error(`Error fetching reviews for property ${property.property_id}:`, reviewError);
            return { ...property, avgRating: 0, reviewCount: 0 };
          }

          const avgRating = reviews && reviews.length > 0
            ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
            : 0;

          if (avgRating > 0) {
            console.log(`Property ${property.title} has avg rating: ${avgRating} from ${reviews.length} reviews`);
          }

          return {
            ...property,
            avgRating: parseFloat(avgRating.toFixed(1)),
            reviewCount: reviews?.length || 0
          };
        } catch (err) {
          console.error(`Error processing property ${property.property_id}:`, err);
          return { ...property, avgRating: 0, reviewCount: 0 };
        }
      })
    );

    res.json(propertiesWithReviews);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single property by ID with its reviews
router.get('/:id', async (req, res) => {
  try {
    const { data: property, error } = await supabase
      .from('property')
      .select('*')
      .eq('property_id', req.params.id)
      .single();

    if (error) {
      console.error('Error fetching property:', error);
      return res.status(404).json({ error: 'Property not found' });
    }

    // Fetch reviews for this property
    const { data: reviews, error: reviewError } = await supabase
      .from('reviews')
      .select('*')
      .eq('property_id', req.params.id);

    if (!reviewError && reviews) {
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : 0;
      
      property.avgRating = parseFloat(avgRating.toFixed(1));
      property.reviewCount = reviews.length;
      property.reviews = reviews;
    } else {
      property.avgRating = 0;
      property.reviewCount = 0;
      property.reviews = [];
    }

    res.json(property);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;