const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: [true, 'Client name is required'], trim: true },
  email: { type: String, required: [true, 'Client email is required'], lowercase: true },
  bankInfo: { type: String },
  paymentDetails: { type: String },
  phone: { type: String },
  company: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  notes: { type: String },
  isActive: { type: Boolean, default: true },
  totalInvoiced: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Client', ClientSchema);