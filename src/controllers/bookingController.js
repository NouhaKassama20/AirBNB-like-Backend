// src/controllers/bookingController.js
import supabase from '../supabase.js';

// GET /api/bookings
export const getAllBookings = async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      property (
        title,
        location,
        price
      )
    `)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

// GET /api/bookings/guest/:guestId
export const getBookingsByGuest = async (req, res) => {
  const { guestId } = req.params;
  
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      property:property_id (
        property_id,
        title,
        price,
        location,
        img
      )
    `)
    .eq('guest_id', guestId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching guest bookings:', error);
    return res.status(500).json({ error: error.message });
  }
  
  res.json(data);
};

// GET /api/bookings/host/:hostId
export const getBookingsByHost = async (req, res) => {
  const { hostId } = req.params
  console.log(`🔹 GET /api/bookings/host/${hostId}`)

  const { data: property, error: propErr } = await supabase
    .from('property')
    .select('property_id, title, location')
    .eq('host_id', hostId)

  if (propErr) {
    console.error('❌ Properties fetch error:', propErr)
    return res.status(500).json({ error: propErr.message })
  }

  if (!property || property.length === 0) {
    return res.json([])
  }

  const propertyIds = property.map(p => p.property_id)
  const propertyMap = Object.fromEntries(property.map(p => [p.property_id, p.title || 'Propriété']))

  const { data: bookings, error: bkErr } = await supabase
    .rpc('get_bookings_by_host', { host_uuid: hostId })

  if (bkErr) {
    console.error('❌ Bookings fetch error:', bkErr)
    return res.status(500).json({ error: bkErr.message })
  }

  const guestIds = [...new Set((bookings || []).map(b => b.guest_id).filter(Boolean))]
  let guestMap = {}

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

  res.json(enriched)
}

// POST /api/bookings - WITH DUPLICATE CHECK
export const createBooking = async (req, res) => {
  const { guest_id, property_id, arrival, departure, travelers, total_price, status, reminder_date } = req.body

  if (!guest_id || !property_id || !arrival || !departure || !total_price) {
    return res.status(400).json({ error: 'Champs requis manquants' })
  }

  // ✅ Check if guest already has a booking for the same property with overlapping dates
  const { data: guestConflict, error: guestConflictErr } = await supabase
    .from('bookings')
    .select('booking_id, arrival, departure, status')
    .eq('guest_id', guest_id)
    .eq('property_id', property_id)
    .in('status', ['pending', 'confirmed'])
    .or(`and(arrival.lte.${departure},departure.gte.${arrival})`)

  if (guestConflictErr) {
    return res.status(500).json({ error: guestConflictErr.message })
  }

  if (guestConflict && guestConflict.length > 0) {
    return res.status(409).json({ 
      error: 'Vous avez déjà une réservation pour cette propriété pendant cette période.',
      conflict: {
        arrival: guestConflict[0].arrival,
        departure: guestConflict[0].departure,
        status: guestConflict[0].status
      }
    })
  }

  // ✅ Check for confirmed bookings that overlap with requested dates (from other guests)
  const { data: conflicts, error: conflictErr } = await supabase
    .from('bookings')
    .select('booking_id, arrival, departure, status')
    .eq('property_id', property_id)
    .eq('status', 'confirmed')
    .or(`and(arrival.lte.${departure},departure.gte.${arrival})`)

  if (conflictErr) {
    return res.status(500).json({ error: conflictErr.message })
  }

  if (conflicts && conflicts.length > 0) {
    return res.status(409).json({ 
      error: 'Cette propriété est déjà réservée pour cette période.',
      conflict: {
        arrival: conflicts[0].arrival,
        departure: conflicts[0].departure
      }
    })
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
      created_at: new Date()
    }])
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
}

export const updateBookingStatus = async (req, res) => {
  const { status } = req.body
  const { id } = req.params

  const VALID = ['pending', 'confirmed', 'cancelled', 'completed']
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${VALID.join(', ')}` })
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('booking_id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  
  res.json({ 
    success: true, 
    booking: data,
    message: `Réservation ${status === 'confirmed' ? 'confirmée' : status === 'cancelled' ? 'annulée' : 'mise à jour'} avec succès`
  })
}

// UPDATE booking dates
export const updateBookingDates = async (req, res) => {
  const { bookingId } = req.params
  const { arrival, departure, guest_id } = req.body

  if (!arrival || !departure) {
    return res.status(400).json({ error: 'Les dates d\'arrivée et de départ sont requises' })
  }

  if (new Date(arrival) >= new Date(departure)) {
    return res.status(400).json({ error: 'La date de départ doit être après la date d\'arrivée' })
  }

  if (new Date(arrival) < new Date()) {
    return res.status(400).json({ error: 'Impossible de modifier vers une date passée' })
  }

  try {
    const { data: currentBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('property_id, status, guest_id')
      .eq('booking_id', bookingId)
      .single()

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message })
    }

    if (!currentBooking) {
      return res.status(404).json({ error: 'Réservation non trouvée' })
    }

    // Check if guest already has another booking for same property with overlapping dates
    const { data: guestOverlap, error: guestOverlapErr } = await supabase
      .from('bookings')
      .select('booking_id')
      .eq('guest_id', guest_id || currentBooking.guest_id)
      .eq('property_id', currentBooking.property_id)
      .neq('booking_id', bookingId)
      .in('status', ['pending', 'confirmed'])
      .or(`and(arrival.lte.${departure},departure.gte.${arrival})`)

    if (guestOverlapErr) {
      return res.status(500).json({ error: guestOverlapErr.message })
    }

    if (guestOverlap && guestOverlap.length > 0) {
      return res.status(409).json({
        error: 'Vous avez déjà une réservation pour cette propriété pendant cette période.'
      })
    }

    // Check for overlapping confirmed bookings from other guests
    const { data: conflicts, error: conflictError } = await supabase
      .from('bookings')
      .select('booking_id, arrival, departure')
      .eq('property_id', currentBooking.property_id)
      .eq('status', 'confirmed')
      .neq('booking_id', bookingId)
      .or(`and(arrival.lte.${departure},departure.gte.${arrival})`)

    if (conflictError) {
      return res.status(500).json({ error: conflictError.message })
    }

    if (conflicts && conflicts.length > 0) {
      return res.status(409).json({
        error: 'Ces dates entrent en conflit avec une réservation déjà confirmée',
        conflicts: conflicts.map(c => ({
          arrival: c.arrival,
          departure: c.departure
        }))
      })
    }

    // Update the booking dates
    const { data, error } = await supabase
      .from('bookings')
      .update({ 
        arrival, 
        departure,
        status: 'pending'
      })
      .eq('booking_id', bookingId)
      .select()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json({ 
      success: true, 
      booking: data[0],
      message: 'Dates modifiées avec succès. La réservation est en attente de confirmation.'
    })

  } catch (error) {
    console.error('Error updating booking dates:', error)
    res.status(500).json({ error: 'Erreur lors de la modification des dates' })
  }
}

export const cancelBooking = async (req, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('booking_id', id)

  if (error) return res.status(500).json({ error: error.message })
  
  res.json({ message: 'Booking cancelled successfully' })
}

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