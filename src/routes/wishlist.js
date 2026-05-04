// src/routes/wishlist.js
import express from 'express';
import supabase from '../supabase.js';

const router = express.Router();

// ✅ DELETE - Remove from wishlist
router.delete('/', async (req, res) => {
  const { guest_id, property_id } = req.body;
  
  if (!guest_id || !property_id) {
    return res.status(400).json({ error: 'guest_id and property_id are required' });
  }
  
  try {
    const { data: existing, error: checkError } = await supabase
      .from('wishlist')
      .select('id')
      .eq('guest_id', guest_id)
      .eq('property_id', property_id);
    
    if (checkError) return res.status(500).json({ error: checkError.message });
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Item not found in wishlist' });
    }
    
    const { error: deleteError } = await supabase
      .from('wishlist')
      .delete()
      .eq('guest_id', guest_id)
      .eq('property_id', property_id);
    
    if (deleteError) return res.status(500).json({ error: deleteError.message });
    
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ POST - Add to wishlist
router.post('/', async (req, res) => {
  const { guest_id, property_id } = req.body;
  
  if (!guest_id || !property_id) {
    return res.status(400).json({ error: 'guest_id and property_id are required' });
  }
  
  try {
    const { data: existing, error: checkError } = await supabase
      .from('wishlist')
      .select('id')
      .eq('guest_id', guest_id)
      .eq('property_id', property_id)
      .maybeSingle();
    
    if (existing) return res.status(409).json({ error: 'Already in wishlist' });
    
    const { data, error } = await supabase
      .from('wishlist')
      .insert([{ guest_id, property_id, added_at: new Date() }])
      .select();
    
    if (error) return res.status(500).json({ error: error.message });
    
    res.status(201).json({ success: true, wishlist: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET - Check if property is in wishlist
// ⚠️ MUST be declared BEFORE /:guestId — otherwise Express matches "check" as guestId
router.get('/check/:guestId/:propertyId', async (req, res) => {
  const { guestId, propertyId } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('wishlist')
      .select('id')
      .eq('guest_id', guestId)
      .eq('property_id', propertyId)
      .maybeSingle();
    
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ exists: !!data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ GET - Get wishlist by guest ID
// ⚠️ Must come AFTER /check to avoid swallowing that route
router.get('/:guestId', async (req, res) => {
  const { guestId } = req.params;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(guestId)) {
    return res.status(400).json({ error: 'Invalid guest ID format' });
  }
  
  try {
    const { data, error } = await supabase
      .from('wishlist')
      .select(`
        id,
        property_id,
        added_at,
        property:property_id (
          property_id,
          title,
          price,
          location,
          wilaya,
          img,
          voyageurs,
          chambres,
          salle_de_bain
        )
      `)
      .eq('guest_id', guestId)
      .order('added_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;