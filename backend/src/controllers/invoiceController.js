const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const User = require('../models/User');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { sendInvoiceEmail } = require('../utils/emailService');

const calculateTotals = (lineItems, taxRate = 0, discount = 0) => {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount - discount;
  return { subtotal, taxAmount, total };
};

exports.getInvoices = async (req, res) => {
  try {
    const { status, client, page = 1, limit = 10, sort = '-createdAt', search } = req.query;
    const query = { user: req.user._id };

    if (status) query.status = status;
    if (client) query.client = client;
    if (search) query.invoiceNumber = { $regex: search, $options: 'i' };

    await Invoice.updateMany(
      { user: req.user._id, status: { $in: ['sent', 'viewed'] }, dueDate: { $lt: new Date() } },
      { status: 'overdue' }
    );

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .populate('client', 'name email company')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({ success: true, data: invoices, total, pages: Math.ceil(total / limit), page: Number(page) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id })
      .populate('client')
      .populate('user', 'name email businessName businessAddress phone currency');

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const { clientId, lineItems, taxRate, discount, dueDate, notes, terms, currency } = req.body;

    const client = await Client.findOne({ _id: clientId, user: req.user._id });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const processedItems = lineItems.map(item => ({
      ...item,
      amount: item.quantity * item.rate
    }));

    const { subtotal, taxAmount, total } = calculateTotals(processedItems, taxRate || req.user.taxRate, discount || 0);

    const user = await User.findById(req.user._id);
    const invoiceNumber = `${user.invoicePrefix}-${String(user.nextInvoiceNumber).padStart(4, '0')}`;
    await User.findByIdAndUpdate(req.user._id, { $inc: { nextInvoiceNumber: 1 } });

    const invoice = await Invoice.create({
      user: req.user._id,
      client: clientId,
      invoiceNumber,
      lineItems: processedItems,
      subtotal,
      taxRate: taxRate || req.user.taxRate || 0,
      taxAmount,
      discount: discount || 0,
      total,
      dueDate,
      notes,
      terms: terms || req.user.paymentTerms,
      currency: currency || req.user.currency || 'USD'
    });

    await Client.findByIdAndUpdate(clientId, { $inc: { totalInvoiced: total } });
    await invoice.populate('client', 'name email company');
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Cannot edit a paid invoice' });
    }

    if (req.body.lineItems) {
      req.body.lineItems = req.body.lineItems.map(item => ({
        ...item,
        amount: item.quantity * item.rate
      }));
      const { subtotal, taxAmount, total } = calculateTotals(
        req.body.lineItems,
        req.body.taxRate ?? invoice.taxRate,
        req.body.discount ?? invoice.discount
      );
      req.body.subtotal = subtotal;
      req.body.taxAmount = taxAmount;
      req.body.total = total;
    }

    const updated = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('client', 'name email company');

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Cannot delete a paid invoice' });
    }

    await Client.findByIdAndUpdate(invoice.client, { $inc: { totalInvoiced: -invoice.total } });
    await invoice.deleteOne();
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id })
      .populate('client')
      .populate('user', 'name email businessName businessAddress phone currency');

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const pdfBuffer = await generateInvoicePDF(invoice, invoice.client, invoice.user);

    await sendInvoiceEmail({
      to: invoice.client.email,
      clientName: invoice.client.name,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      pdfBuffer,
      senderName: invoice.user.name,
      senderBusiness: invoice.user.businessName
    });

    await Invoice.findByIdAndUpdate(invoice._id, { status: 'sent', sentAt: new Date() });
    res.json({ success: true, message: 'Invoice sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadPDF = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id })
      .populate('client')
      .populate('user', 'name email businessName businessAddress phone currency');

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const pdfBuffer = await generateInvoicePDF(invoice, invoice.client, invoice.user);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsPaid = async (req, res) => {
  try {
    const { paidAmount, paymentMethod, paymentNotes } = req.body;
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status: 'paid', paidAt: new Date(), paidAmount: paidAmount || invoice.total, paymentMethod, paymentNotes },
      { new: true }
    ).populate('client', 'name email company');

    await Client.findByIdAndUpdate(invoice.client, { $inc: { totalPaid: paidAmount || invoice.total } });
    res.json({ success: true, data: updatedInvoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.duplicateInvoice = async (req, res) => {
  try {
    const original = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!original) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const user = await User.findById(req.user._id);
    const invoiceNumber = `${user.invoicePrefix}-${String(user.nextInvoiceNumber).padStart(4, '0')}`;
    await User.findByIdAndUpdate(req.user._id, { $inc: { nextInvoiceNumber: 1 } });

    const newInvoice = await Invoice.create({
      user: req.user._id,
      client: original.client,
      invoiceNumber,
      lineItems: original.lineItems,
      subtotal: original.subtotal,
      taxRate: original.taxRate,
      taxAmount: original.taxAmount,
      discount: original.discount,
      total: original.total,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: original.notes,
      terms: original.terms,
      currency: original.currency,
      status: 'draft'
    });

    await Client.findByIdAndUpdate(original.client, { $inc: { totalInvoiced: original.total } });
    await newInvoice.populate('client', 'name email company');
    res.status(201).json({ success: true, data: newInvoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};