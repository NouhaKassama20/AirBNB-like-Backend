import express from 'express'
import * as bookingsController from '../controllers/bookingController.js'
import supabase from '../supabase.js' // ← add this import

const router = express.Router()

router.get('/',                    bookingsController.getAllBookings)
router.get('/guest/:guestId',      bookingsController.getBookingsByGuest)
router.get('/host/:hostId',        bookingsController.getBookingsByHost)
router.post('/',                   bookingsController.createBooking)
router.post('/cancel-overlapping', async (req, res) => {   // ← move BEFORE /:id routes
  const { booking_id, property_id, arrival, departure } = req.body

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('property_id', property_id)
    .eq('status', 'pending')
    .neq('booking_id', booking_id)
    .or(`and(arrival.lte.${departure},departure.gte.${arrival})`)

  if (error) return res.status(500).json({ error: error.message })
  
  res.json({ success: true })
})
router.patch('/:id/status',        bookingsController.updateBookingStatus) // ← only one
router.delete('/:id',              bookingsController.cancelBooking)

export default router


// import express from 'express'
// import * as bookingsController from '../controllers/bookingController.js'

// const router = express.Router()

// router.get('/',                    bookingsController.getAllBookings)
// router.get('/guest/:guestId',      bookingsController.getBookingsByGuest)
// router.get('/host/:hostId',        bookingsController.getBookingsByHost)   // ← NEW
// router.post('/',                   bookingsController.createBooking)
// router.patch('/:id/status',        bookingsController.updateBookingStatus)
// router.delete('/:id',              bookingsController.cancelBooking)
// router.patch('/:bookingId/status', bookingsController.updateBookingStatus);
// router.post('/cancel-overlapping', async (req, res) => {
//   const { booking_id, property_id, arrival, departure } = req.body

//   const { error } = await supabase
//     .from('bookings')
//     .update({ status: 'cancelled' })
//     .eq('property_id', property_id)
//     .eq('status', 'pending')
//     .neq('booking_id', booking_id)
//     .or(`and(arrival.lte.${departure},departure.gte.${arrival})`)

//   if (error) return res.status(500).json({ error: error.message })
  
//   res.json({ success: true })
// })



// export default router