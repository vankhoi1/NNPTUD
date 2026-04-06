const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../../middleware/auth');
const reservationController = require('../../controllers/reservation/reservationController');

// Reader creates own reservations
router.get('/', authenticate, authorize('Reader', 'Librarian', 'Admin'), reservationController.getAllReservations);
router.get('/:id', authenticate, authorize('Reader', 'Librarian', 'Admin'), reservationController.getReservation);

router.post('/', authenticate, authorize('Reader'), reservationController.createReservation);

// Librarian/Admin decisions
router.put('/:id/approve', authenticate, authorize('Librarian', 'Admin'), reservationController.approveReservation);
router.put('/:id/reject', authenticate, authorize('Librarian', 'Admin'), reservationController.rejectReservation);

// Reader cancel
router.put('/:id/cancel', authenticate, authorize('Reader'), reservationController.cancelReservation);

// Optional full CRUD (Admin/Librarian)
router.put('/:id', authenticate, authorize('Admin', 'Librarian'), async (req, res) => {
  // For simplicity, use existing reservation update through Mongoose
  const Reservation = require('../../schemas/reservation/Reservation');
  const updated = await Reservation.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ success: false, message: 'Reservation not found' });
  res.status(200).json({ success: true, data: updated });
});

router.delete('/:id', authenticate, authorize('Admin', 'Librarian'), async (req, res) => {
  const Reservation = require('../../schemas/reservation/Reservation');
  const deleted = await Reservation.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: 'Reservation not found' });
  res.status(200).json({ success: true, data: {} });
});

module.exports = router;

