import supabase from '../supabase.js';

export const getProperties = async (req, res) => {
  const { data, error } = await supabase
    .from('property')
    .select(`
      *,
      reviews!property2_review_id_fkey(
       review_id,
       guest_id,
       booking_id,
       rating,
       comment,
       created_at,
       property_id 
      ),
      host:host_id(
        years_since_beginning,
        users!host_host_id_fkey(  
          full_name,
          age, 
          num_tele,
          email,
          profile_image
        )
      )
    `);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

export const getPropertyById = async (req, res) => {
  const { data, error } = await supabase
    .from('property')
    .select(`
      *,
      reviews!property2_review_id_fkey(
        review_id,
        guest_id,
        booking_id,
        rating,
        comment,
        created_at,
        property_id
      ),
      host:host_id(
        years_since_beginning,
        users!host_host_id_fkey(  
          full_name,
          age, 
          num_tele,
          email,
          profile_image
        )
      )
    `)
    .eq('property_id', req.params.id)
    .single();

   if (error) {
    console.log('Supabase error:', error); // 👈 add this
    return res.status(404).json({ error: error.message });
  }
  res.json(data);
};

export const getAllOffers = async (req, res) => {
  const { data, error } = await supabase
    .from('offers')
    .select(`
      *,
      property (
        title,
        description,
        localisation_google_map,
        host_id
      )
    `);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};