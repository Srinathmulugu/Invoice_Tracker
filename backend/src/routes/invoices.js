const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice,
  sendInvoice, downloadPDF, markAsPaid, duplicateInvoice,
  checkDuplicateInvoice, exportInvoicesCsv, exportInvoicesExcel,
  getInvoiceQrCode, createPaymentLink, scanInvoiceOcr
} = require('../controllers/invoiceController');
const { protect, authorizeRoles } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(protect);
router.get('/check-duplicate', checkDuplicateInvoice);
router.post('/ocr/scan', authorizeRoles('admin', 'accountant', 'viewer'), upload.single('file'), scanInvoiceOcr);
router.get('/export/csv', authorizeRoles('admin', 'accountant'), exportInvoicesCsv);
router.get('/export/excel', authorizeRoles('admin', 'accountant'), exportInvoicesExcel);
router.get('/', getInvoices);
router.post('/', authorizeRoles('admin', 'accountant'), createInvoice);
router.get('/:id', getInvoice);
router.put('/:id', authorizeRoles('admin', 'accountant'), updateInvoice);
router.delete('/:id', authorizeRoles('admin'), deleteInvoice);
router.post('/:id/send', authorizeRoles('admin', 'accountant'), sendInvoice);
router.get('/:id/pdf', downloadPDF);
router.get('/:id/qr', getInvoiceQrCode);
router.post('/:id/payment-link', authorizeRoles('admin', 'accountant'), createPaymentLink);
router.put('/:id/mark-paid', authorizeRoles('admin', 'accountant'), markAsPaid);
router.post('/:id/duplicate', authorizeRoles('admin', 'accountant'), duplicateInvoice);

module.exports = router;