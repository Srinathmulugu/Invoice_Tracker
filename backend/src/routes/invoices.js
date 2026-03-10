const express = require('express');
const router = express.Router();
const {
  getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice,
  sendInvoice, downloadPDF, markAsPaid, duplicateInvoice
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getInvoices);
router.post('/', createInvoice);
router.get('/:id', getInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);
router.post('/:id/send', sendInvoice);
router.get('/:id/pdf', downloadPDF);
router.put('/:id/mark-paid', markAsPaid);
router.post('/:id/duplicate', duplicateInvoice);

module.exports = router;