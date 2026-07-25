/**
 * Booking.js
 * One document per booking. Stores both the customer and the owner
 * (denormalized from the venue) so the owner portal's "my bookings"
 * query doesn't need to look up the venue first just to filter by owner.
 */

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true, index: true },

    date: { type: String, required: [true, 'Booking date is required'] }, // 'YYYY-MM-DD'
    time: { type: String, required: [true, 'Time slot is required'] },    // e.g. '6:00 PM'
    durationHours: { type: Number, default: 1, min: 1 },

    amount: { type: Number, required: true, min: 0 },
    commissionPct: { type: Number, default: 10 },

    status: {
      type: String,
      enum: ['upcoming', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    refundStatus: {
      type: String,
      enum: ['none', 'requested', 'approved', 'rejected'],
      default: 'none',
    },
    refundReason: { type: String },
    refundRejectReason: { type: String },
    refundPct: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    refundRequestedAt: { type: Date },

    // Filled in by routes/payments.js in Part 2 once Razorpay confirms.
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },

    // ── NEW FEATURES ──────────────────────────────────────────
    courtNumber: { type: Number, default: 1 }, // Specific court/turf selected (1, 2, 3...)
    holdExpiresAt: { type: Date, default: null, index: true }, // 5-minute hold expiry timestamp
    isSplit: { type: Boolean, default: false },
    splitCode: { type: String, default: null, index: true },
    splitPayments: [
      {
        payerName: { type: String },
        amount: { type: Number },
        razorpayPaymentId: { type: String },
        paidAt: { type: Date, default: Date.now },
      },
    ],
    qrCodeData: { type: String, default: null }, // Unique hash for QR ticket scanning
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
