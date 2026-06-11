const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  tokenNumber: {
    type: Number,
    default: null
  },
  date: {
    type: String, // Stored as YYYY-MM-DD
    required: true
  },
  timeSlot: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'In Consultation', 'Completed', 'Rejected', 'Rescheduled'],
    default: 'Pending'
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Compound index to help with daily token lookup and patient unique constraint per day per doctor
appointmentSchema.index({ doctor: 1, date: 1, tokenNumber: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
