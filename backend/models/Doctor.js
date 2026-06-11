const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  specialty: {
    type: String,
    required: true
  },
  cabinNumber: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Available', 'On Break', 'Unavailable'],
    default: 'Available'
  }
}, { timestamps: true });

module.exports = mongoose.model('Doctor', doctorSchema);
