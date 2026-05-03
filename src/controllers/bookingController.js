import supabase from '../supabase.js'

// GET /api/bookings
export const getAllBookings = async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      property (
        title,
        location,
        price,
        
      )
    `)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

// GET /api/bookings/guest/:guestId
export const getBookingsByGuest = async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      property(
        title,
        price,
        location
      )
    `)
    .eq('guest_id', req.params.guestId)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

// GET /api/bookings/host/:hostId
export const getBookingsByHost = async (req, res) => {
  const { hostId } = req.params
  console.log(`🔹 GET /api/bookings/host/${hostId}`)

  // 1. Get all property_ids belonging to this host
  const { data: property, error: propErr } = await supabase
    .from('property')
    .select('property_id, title, location')
    .eq('host_id', hostId)
  console.log("😂😂😂😂😂 Property: ", property)  

  if (propErr) {
    console.error('❌ Properties fetch error:', propErr)
    return res.status(500).json({ error: propErr.message })
  }

  if (!property || property.length === 0) {
    return res.json([])
  }

  const propertyIds = property.map(p => p.property_id)
  const propertyMap = Object.fromEntries(property.map(p => [p.property_id, p.title || 'Propriété']))
  console.log("1️⃣1️⃣ ids: ", propertyIds)

  // 2. Get all bookings for those properties
  // const { data: bookings, error: bkErr } = await supabase
  //   .from('bookings')
  //   .select('*')
  //   .in('property_id', propertyIds)
  // 2. Get all bookings for those properties - use contains check instead of .in()
  // const { data: bookings, error: bkErr } = await supabase
  // .from('bookings')
  // .select('*')
  // .or(propertyIds.map(id => `property_id.eq.${id}`).join(','))
  //   // .order('created_at', { ascending: false }) 
  // console.log("🏠🏠🏠 ",bookings)  
  const { data: bookings, error: bkErr } = await supabase
  .rpc('get_bookings_by_host', { host_uuid: hostId })
  console.log("🏠🏠🏠 ", bookings)
  console.log("❌ bkErr:", bkErr) 

  if (bkErr) {
    console.error('❌ Bookings fetch error:', bkErr)
    return res.status(500).json({ error: bkErr.message })
  }

  // 3. Get guest info for each unique guest_id
  const guestIds = [...new Set((bookings || []).map(b => b.guest_id).filter(Boolean))]
  let guestMap = {}

  console.log('🥸',guestIds)
  if (guestIds.length > 0) {
    const { data: guests, error: gErr } = await supabase
      .from('guests')
      .select('guest_id, full_name, email, num_tele, profile_image')
      .in('guest_id', guestIds)

    if (!gErr && guests) {
      guestMap = Object.fromEntries((guests || []).map(g => [g.guest_id, g]))
    } else {
      console.error('❌ Guests fetch error:', gErr)
    }
  }

  // 4. Enrich and return
  const enriched = (bookings || []).map(b => ({
    booking_id: b.booking_id,
    arrival: b.arrival,
    departure: b.departure,
    travelers: b.travelers,
    total_price: b.total_price,
    status: b.status,
    created_at: b.created_at,
    property_id: b.property_id,
    property_name: propertyMap[b.property_id] || '—',
    guest: guestMap[b.guest_id] || null,
    guest_name: guestMap[b.guest_id]?.full_name || 'Voyageur',
    guest_email: guestMap[b.guest_id]?.email || '',
    guest_phone: guestMap[b.guest_id]?.num_tele || '',
    guest_image: guestMap[b.guest_id]?.profile_image || null
  }))

  console.log(`✅ ${enriched.length} bookings fetched for host ${hostId}`)
  res.json(enriched)
}

// POST /api/bookings
export const createBooking = async (req, res) => {
  const { guest_id, property_id, arrival, departure, travelers, total_price, status, reminder_date } = req.body

  // Validation des champs requis
  if (!guest_id || !property_id || !arrival || !departure || !total_price) {
    return res.status(400).json({ error: 'Champs requis manquants' })
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert([{ 
      guest_id, 
      property_id, 
      arrival, 
      departure, 
      travelers, 
      total_price, 
      status: status || 'pending', 
      // reminder_date,
      created_at: new Date()
    }])
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
}

// PATCH /api/bookings/:id/status
export const updateBookingStatus = async (req, res) => {
  const { status } = req.body
  const { id } = req.params

  const VALID = ['pending', 'confirmed', 'cancelled', 'completed']
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${VALID.join(', ')}` })
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({ status, updated_at: new Date() })
    .eq('booking_id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  
  console.log(`✅ Booking ${id} status updated to ${status}`)
  res.json({ 
    success: true, 
    booking: data,
    message: `Réservation ${status === 'confirmed' ? 'confirmée' : status === 'cancelled' ? 'annulée' : 'mise à jour'} avec succès`
  })
}

// DELETE /api/bookings/:id
export const cancelBooking = async (req, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('booking_id', id)

  if (error) return res.status(500).json({ error: error.message })
  
  res.json({ message: 'Booking cancelled successfully' })
}

// GET /api/bookings/:id - Récupérer une réservation spécifique
export const getBookingById = async (req, res) => {
  const { id } = req.params

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      property (
        title,
        price,
        location,
        img
      ),
      guests (
        full_name,
        email,
        num_tele,
        profile_image
      )
    `)
    .eq('booking_id', id)
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Réservation non trouvée' })
  
  res.json(data)
}