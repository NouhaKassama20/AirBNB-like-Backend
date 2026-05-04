// src/routes/bookings.js
import express from 'express'
import * as bookingsController from '../controllers/bookingController.js'

const router = express.Router()

router.get('/guest/:guestId', bookingsController.getBookingsByGuest)
router.get('/host/:hostId', bookingsController.getBookingsByHost)
router.get('/:id', bookingsController.getBookingById)
router.get('/', bookingsController.getAllBookings)

router.post('/', bookingsController.createBooking)
router.patch('/:id/status', bookingsController.updateBookingStatus)
router.patch('/:bookingId/dates', bookingsController.updateBookingDates) // ✅ Edit dates route
router.delete('/:id', bookingsController.cancelBooking)

export default router