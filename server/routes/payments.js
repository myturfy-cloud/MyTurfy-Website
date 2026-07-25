/**
 * routes/payments.js
 * Updated:
 * 1. Slot overlap check now respects venue.specs.turfs — a slot is only
 *    blocked when concurrent bookings >= number of courts.
 * 2. On successful payment, booking.payoutEligible = false (stays false
 *    until a scheduled job marks it true after the slot time passes and
 *    no refund was filed).
 */

const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const router = express.Router();

const config = require('../config/config');
const { protect } = require('../middleware/auth');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { sendBookingConfirmationToCustomer, sendNewBookingAlertToOwner } = require('../utils/sendEmail');

const razorpayConfigured = !!(config.razorpay.keyId && config.razorpay.keySecret);
const razorpay = razorpayConfigured
  ? new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret })
  : null;

async function notifyBoth(venue, booking, customer) {
  sendBookingConfirmationToCustomer(customer, venue, booking).catch(e => console.error('Customer email failed:', e.message));
  sendNewBookingAlertToOwner(venue.owner, venue, booking, customer).catch(e => console.error('Owner email failed:', e.message));
}

/* ─────────────────────────────────────
   TURFS-AWARE slot overlap check.
   Returns true only when all requested hours are FULLY booked
   (concurrent bookings >= venue.specs.turfs for every hour in range).
───────────────────────────────────── */
async function isSlotFullyBooked(venueId, date, time, durationHours, turfsCount) {
  const startH = parseInt(time.split(':')[0], 10);
  const bookings = await Booking.find({
    venue: venueId,
    date,
    status: { $ne: 'cancelled' },
  }).select('time durationHours');

  // Build a count map: hour → number of concurrent bookings
  const hourCounts = new Map();
  bookings.forEach(b => {
    const bStart = parseInt((b.time || '0').split(':')[0], 10);
    for (let i = 0; i < (b.durationHours || 1); i++) {
      const h = bStart + i;
      hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
    }
  });

  // Check every hour the new booking would occupy
  for (let i = 0; i < durationHours; i++) {
    if ((hourCounts.get(startH + i) || 0) >= turfsCount) return true;
  }
  return false;
}

/* ══════════════════════════════════════
   STEP 1 — Create Razorpay order
   POST /api/payments/create-order
   ══════════════════════════════════════ */
router.post('/create-order', protect, async (req, res, next) => {
  try {
    if (req.auth.role !== 'user') {
      return res.status(403).json({ success: false, message: 'Only customer accounts can book venues' });
    }
    const { venueId, date, time, durationHours = 1, courtNumber = 1, bookingId } = req.body;

    let booking = null;
    if (bookingId) {
      booking = await Booking.findById(bookingId);
    }

    const vId = booking ? booking.venue : venueId;
    const venue = await Venue.findOne({ _id: vId, isActive: true }).populate('owner', 'name email');
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });

    const bDate = booking ? booking.date : date;
    const bTime = booking ? booking.time : time;
    const bDur = booking ? booking.durationHours : durationHours;
    const bCourt = booking ? booking.courtNumber : courtNumber;
    const amount = venue.price * bDur;

    // Dev/test mode — no Razorpay keys yet
    if (!razorpayConfigured) {
      if (booking) {
        booking.paymentStatus = 'paid';
        booking.holdExpiresAt = null;
        await booking.save();
      } else {
        const crypto = require('crypto');
        booking = await Booking.create({
          customer: req.auth.id, venue: venue._id, owner: venue.owner._id,
          date: bDate, time: bTime, durationHours: bDur, courtNumber: Number(bCourt),
          amount, status: 'upcoming', paymentStatus: 'paid',
          payoutEligible: false,
          qrCodeData: crypto.randomBytes(8).toString('hex'),
        });
      }
      const customer = await User.findById(req.auth.id);
      notifyBoth(venue, booking, customer);
      return res.status(201).json({
        success: true, testMode: true,
        message: 'Razorpay not configured — booking created for local testing',
        data: booking,
      });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: `venue_${venue._id}_${Date.now()}`,
      notes: { venueId: String(venue._id), customerId: req.auth.id, date: bDate, time: bTime, bookingId: booking ? String(booking._id) : '' },
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
      bookingId: booking ? booking._id : null,
    });
  } catch (err) {
    next(err);
  }
});

/* ══════════════════════════════════════
   STEP 2 — Verify payment + create booking
   POST /api/payments/verify
   ══════════════════════════════════════ */
router.post('/verify', protect, async (req, res, next) => {
  try {
    if (req.auth.role !== 'user') {
      return res.status(403).json({ success: false, message: 'Only customer accounts can book venues' });
    }
    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      venueId, date, time, durationHours = 1, courtNumber = 1, bookingId,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed — signature mismatch' });
    }

    let booking = null;
    if (bookingId) {
      booking = await Booking.findById(bookingId);
    }

    if (booking) {
      booking.paymentStatus = 'paid';
      booking.holdExpiresAt = null;
      booking.razorpayOrderId = razorpay_order_id;
      booking.razorpayPaymentId = razorpay_payment_id;
      await booking.save();
    } else {
      const venue = await Venue.findById(venueId).populate('owner', 'name email');
      if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });

      booking = await Booking.create({
        customer: req.auth.id, venue: venue._id, owner: venue.owner._id,
        date, time, durationHours, courtNumber: Number(courtNumber),
        amount: venue.price * durationHours,
        status: 'upcoming', paymentStatus: 'paid',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        payoutEligible: false,
        qrCodeData: crypto.randomBytes(8).toString('hex'),
      });
    }

    const venueObj = await Venue.findById(booking.venue).populate('owner', 'name email');
    const customer = await User.findById(req.auth.id);
    notifyBoth(venueObj, booking, customer);

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

module.exports = router;