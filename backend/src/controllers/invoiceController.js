const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const User = require('../models/User');
const QRCode = require('qrcode');
const XLSX = require('xlsx');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { sendInvoiceEmail } = require('../utils/emailService');
const { encryptText, decryptText } = require('../utils/encryption');
const { calculateFraudSignals } = require('../services/detectionService');
const { extractInvoiceFields } = require('../services/ocrService');

const calculateTotals = (lineItems, taxRate = 0, discount = 0) => {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount - discount;
  return { subtotal, taxAmount, total };
};

const decryptClient = (client) => {
  if (!client) return client;
  const c = client.toObject ? client.toObject() : { ...client };
  c.email = decryptText(c.email);
  c.bankInfo = decryptText(c.bankInfo);
  c.paymentDetails = decryptText(c.paymentDetails);
  return c;
};

const decryptInvoice = (invoice) => {
  const i = invoice.toObject ? invoice.toObject() : { ...invoice };
  i.paymentMethod = decryptText(i.paymentMethod);
  i.paymentNotes = decryptText(i.paymentNotes);
  i.bankInfo = decryptText(i.bankInfo);
  i.paymentDetails = decryptText(i.paymentDetails);
  if (i.client) i.client = decryptClient(i.client);
  return i;
};

const buildCsv = (rows) => {
  const header = ['Invoice Number', 'Client', 'Status', 'Issue Date', 'Due Date', 'Total', 'Currency', 'Suspicious'];
  const body = rows.map((r) => [
    r.invoiceNumber,
    r.client?.name || '',
    r.status,
    new Date(r.issueDate).toISOString().slice(0, 10),
    new Date(r.dueDate).toISOString().slice(0, 10),
    r.total,
    r.currency,
    r.suspicious ? 'Yes' : 'No'
  ]);
  return [header, ...body]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
};

exports.checkDuplicateInvoice = async (req, res) => {
  try {
    const { invoiceNumber } = req.query;
    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: 'invoiceNumber is required' });
    }

    const existing = await Invoice.findOne({
      user: req.user._id,
      invoiceNumber,
      _id: { $ne: req.query.excludeId }
    }).select('_id invoiceNumber status total');

    res.json({ success: true, duplicate: Boolean(existing), existing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
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

    res.json({
      success: true,
      data: invoices.map(decryptInvoice),
      total,
      pages: Math.ceil(total / limit),
      page: Number(page)
    });
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
    res.json({ success: true, data: decryptInvoice(invoice) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const {
      clientId,
      lineItems,
      taxRate,
      discount,
      dueDate,
      notes,
      terms,
      currency,
      invoiceNumber: customInvoiceNumber,
      paymentMethod,
      paymentNotes,
      bankInfo,
      paymentDetails,
      recurring
    } = req.body;

    const client = await Client.findOne({ _id: clientId, user: req.user._id });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const processedItems = lineItems.map(item => ({
      ...item,
      amount: item.quantity * item.rate
    }));

    const { subtotal, taxAmount, total } = calculateTotals(processedItems, taxRate || req.user.taxRate, discount || 0);

    const user = await User.findById(req.user._id);
    let invoiceNumber = customInvoiceNumber;

    if (invoiceNumber) {
      const existing = await Invoice.findOne({ user: req.user._id, invoiceNumber });
      if (existing) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          message: 'Duplicate Invoice Warning: invoice number already exists'
        });
      }
    } else {
      invoiceNumber = `${user.invoicePrefix}-${String(user.nextInvoiceNumber).padStart(4, '0')}`;
      user.nextInvoiceNumber += 1;
      await user.save();
    }

    const { suspicious, riskScore, avgTotal } = await calculateFraudSignals({
      userId: req.user._id,
      total
    });

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
      currency: currency || req.user.currency || 'USD',
      paymentMethod: encryptText(paymentMethod),
      paymentNotes: encryptText(paymentNotes),
      bankInfo: encryptText(bankInfo),
      paymentDetails: encryptText(paymentDetails),
      suspicious,
      riskScore,
      duplicateWarning: false,
      reminderEnabled: req.body.reminderEnabled !== false,
      recurring: {
        enabled: Boolean(recurring?.enabled),
        frequency: recurring?.frequency || 'monthly',
        nextRunAt: recurring?.enabled ? new Date(dueDate || Date.now()) : undefined
      }
    });

    await Client.findByIdAndUpdate(clientId, { $inc: { totalInvoiced: total } });
    await invoice.populate('client', 'name email company');
    res.status(201).json({
      success: true,
      data: decryptInvoice(invoice),
      warnings: suspicious ? [`Suspicious Invoice: amount is much higher than your average (${avgTotal.toFixed(2)})`] : []
    });
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

    if (req.body.invoiceNumber && req.body.invoiceNumber !== invoice.invoiceNumber) {
      const duplicate = await Invoice.findOne({ user: req.user._id, invoiceNumber: req.body.invoiceNumber, _id: { $ne: req.params.id } });
      if (duplicate) {
        return res.status(409).json({ success: false, duplicate: true, message: 'Duplicate Invoice Warning: invoice number already exists' });
      }
    }

    if (req.body.total || req.body.lineItems) {
      const fraud = await calculateFraudSignals({ userId: req.user._id, total: req.body.total || invoice.total, ignoreInvoiceId: req.params.id });
      req.body.suspicious = fraud.suspicious;
      req.body.riskScore = fraud.riskScore;
    }

    if (req.body.paymentMethod !== undefined) req.body.paymentMethod = encryptText(req.body.paymentMethod);
    if (req.body.paymentNotes !== undefined) req.body.paymentNotes = encryptText(req.body.paymentNotes);
    if (req.body.bankInfo !== undefined) req.body.bankInfo = encryptText(req.body.bankInfo);
    if (req.body.paymentDetails !== undefined) req.body.paymentDetails = encryptText(req.body.paymentDetails);
    if (req.body.reminderEnabled !== undefined) req.body.reminderEnabled = Boolean(req.body.reminderEnabled);

    const updated = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('client', 'name email company');

    res.json({ success: true, data: decryptInvoice(updated) });
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

    const recipientEmail = decryptText(invoice.client.email);
    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: 'Client email is missing' });
    }

    const pdfBuffer = await generateInvoicePDF(invoice, invoice.client, invoice.user);

    await sendInvoiceEmail({
      to: recipientEmail,
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
    const { paidAmount, paymentMethod, paymentNotes, bankInfo, paymentDetails } = req.body;
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        status: 'paid',
        paidAt: new Date(),
        paidAmount: paidAmount || invoice.total,
        paymentMethod: encryptText(paymentMethod),
        paymentNotes: encryptText(paymentNotes),
        bankInfo: encryptText(bankInfo),
        paymentDetails: encryptText(paymentDetails)
      },
      { new: true }
    ).populate('client', 'name email company');

    await Client.findByIdAndUpdate(invoice.client, { $inc: { totalPaid: paidAmount || invoice.total } });
    res.json({ success: true, data: decryptInvoice(updatedInvoice) });
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
    res.status(201).json({ success: true, data: decryptInvoice(newInvoice) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportInvoicesCsv = async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user._id }).populate('client', 'name').sort({ createdAt: -1 });
    const csv = buildCsv(invoices);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportInvoicesExcel = async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user._id }).populate('client', 'name').sort({ createdAt: -1 });
    const rows = invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      client: inv.client?.name || '',
      status: inv.status,
      issueDate: new Date(inv.issueDate).toISOString().slice(0, 10),
      dueDate: new Date(inv.dueDate).toISOString().slice(0, 10),
      total: inv.total,
      currency: inv.currency,
      suspicious: inv.suspicious ? 'Yes' : 'No'
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.xlsx"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInvoiceQrCode = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const payload = JSON.stringify({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      dueDate: invoice.dueDate,
      status: invoice.status
    });

    const dataUrl = await QRCode.toDataURL(payload, { width: 320, margin: 1 });
    res.json({ success: true, data: { qrCode: dataUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPaymentLink = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id }).populate('client', 'name');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const provider = (req.body.provider || 'upi').toLowerCase();
    const upiId = process.env.PAYMENT_UPI_ID || 'merchant@upi';
    const amount = Number(invoice.total || 0).toFixed(2);
    const note = encodeURIComponent(`Invoice ${invoice.invoiceNumber}`);

    let paymentUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(invoice.client?.name || 'Invoice Payment')}&am=${amount}&tn=${note}`;
    if (provider === 'razorpay') {
      paymentUrl = `${process.env.RAZORPAY_PAYMENT_BASE_URL || 'https://rzp.io/l/mock-payment'}/${invoice._id}`;
    }
    if (provider === 'phonepe') {
      paymentUrl = `${process.env.PHONEPE_PAYMENT_BASE_URL || 'https://phonepe.com/payment/mock'}/${invoice._id}`;
    }

    res.json({ success: true, data: { provider, paymentUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.scanInvoiceOcr = async (req, res) => {
  try {
    const imageBuffer = req.file?.buffer;
    const rawText = req.body?.text;
    if (!imageBuffer && !rawText) {
      return res.status(400).json({ success: false, message: 'Upload an image file or send raw text to parse' });
    }

    const data = await extractInvoiceFields({ imageBuffer, rawText });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};