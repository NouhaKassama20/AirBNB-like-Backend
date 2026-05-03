import express from 'express'
import * as bookingsController from '../controllers/bookingController.js'

const router = express.Router()

router.get('/',                    bookingsController.getAllBookings)
router.get('/guest/:guestId',      bookingsController.getBookingsByGuest)
router.get('/host/:hostId',        bookingsController.getBookingsByHost)   // ← NEW
router.post('/',                   bookingsController.createBooking)
router.patch('/:id/status',        bookingsController.updateBookingStatus)
router.delete('/:id',              bookingsController.cancelBooking)
router.patch('/:bookingId/status', bookingsController.updateBookingStatus);



export default router