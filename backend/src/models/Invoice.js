const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true }
});

const InvoiceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  invoiceNumber: { type: String, required: true },
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  lineItems: [LineItemSchema],
  subtotal: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  notes: { type: String },
  terms: { type: String },
  currency: { type: String, default: 'USD' },
  sentAt: { type: Date },
  paidAt: { type: Date },
  paidAmount: { type: Number, default: 0 },
  paymentMethod: { type: String },
  paymentNotes: { type: String },
  viewedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);