// backend/routes/wishlist.js
import express from 'express';
import supabase from '../supabase.js';

const router = express.Router();

// Add to wishlist
router.post('/', async (req, res) => {
  const { guest_id, property_id } = req.body;

  console.log('POST /api/wishlist - received:', { guest_id, property_id });

  if (!guest_id || !property_id) {
    return res.status(400).json({ error: 'guest_id and property_id are required' });
  }

  try {
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('guest_id', guest_id)
      .eq('property_id', property_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Already in wishlist' });
    }

    const { data, error } = await supabase
      .from('wishlist')
      .insert([{
        guest_id: guest_id,
        property_id: property_id,
        added_at: new Date(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Inserted wishlist item:', data);
    res.status(201).json(data);
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Remove from wishlist
router.delete('/', async (req, res) => {
  const { guest_id, property_id } = req.body;

  console.log('DELETE /api/wishlist - received:', { guest_id, property_id });

  if (!guest_id || !property_id) {
    return res.status(400).json({ error: 'guest_id and property_id are required' });
  }

  try {
    const { data, error } = await supabase
      .from('wishlist')
      .delete()
      .eq('guest_id', guest_id)
      .eq('property_id', property_id)
      .select();

    if (error) {
      console.error('Supabase delete error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    console.log('Deleted wishlist item:', data[0].id);
    res.json({ message: 'Removed from wishlist', id: data[0].id });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// ✅ MUST be before /:guestId
router.get('/check/:guestId/:propertyId', async (req, res) => {
  const { guestId, propertyId } = req.params;

  console.log('GET /api/wishlist/check - checking:', { guestId, propertyId });

  try {
    const { data, error } = await supabase
      .from('wishlist')
      .select('id')
      .eq('guest_id', guestId)
      .eq('property_id', propertyId)
      .maybeSingle();

    if (error) {
      console.error('Supabase check error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ exists: !!data });
  } catch (error) {
    console.error('Check wishlist error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// ✅ MUST be last — wildcard route
router.get('/:guestId', async (req, res) => {
  const { guestId } = req.params;

  console.log('GET /api/wishlist/:guestId - guestId:', guestId);

  try {
    const { data, error } = await supabase
      .from('wishlist')
      .select(`
        id,
        guest_id,
        property_id,
        added_at,
        property:property_id (
          title,
          img,
          wilaya,
          price,
          chambres,
          salle_de_bain,
          voyageurs
        )
      `)
      .eq('guest_id', guestId)
      .order('added_at', { ascending: false });

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`Found ${data?.length || 0} wishlist items`);
    res.json(data || []);
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

export default router;