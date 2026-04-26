import express from 'express'
import supabase from '../supabase.js'

const router = express.Router()

// GET all bookings
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      offers (
        title,
        price_per_night,
        localisation_google_map
      )
    `)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET bookings for a specific guest
router.get('/guest/:guestId', async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      offers (
        title,
        price_per_night,
        localisation_google_map
      )
    `)
    .eq('guest_id', req.params.guestId)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST create a booking
router.post('/', async (req, res) => {
  const { guest_id, offer_id, arrival, departure, travelers, total_price } = req.body

  const { data, error } = await supabase
    .from('bookings')
    .insert([{ guest_id, offer_id, arrival, departure, travelers, total_price }])
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH update booking status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body

  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('booking_id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE cancel a booking
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('booking_id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Booking cancelled successfully' })
})

export default router