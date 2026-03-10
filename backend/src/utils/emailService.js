const nodemailer = require('nodemailer');

const createTransporter = () => nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

exports.sendInvoiceEmail = async ({ to, clientName, invoiceNumber, total, dueDate, currency, pdfBuffer, senderName, senderBusiness }) => {
  const transporter = createTransporter();
  const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(total);
  const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `
    <!DOCTYPE html><html><head><style>
      body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
      .header { background: #4F46E5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { padding: 30px; background: #f9f9f9; }
      .invoice-box { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; }
      .amount { font-size: 2em; font-weight: bold; color: #4F46E5; }
      .footer { text-align: center; padding: 20px; color: #888; font-size: 0.9em; }
    </style></head>
    <body>
      <div class="header"><h1>📄 New Invoice</h1><p>${senderBusiness || senderName}</p></div>
      <div class="content">
        <p>Dear ${clientName},</p>
        <p>Please find attached your invoice from <strong>${senderBusiness || senderName}</strong>.</p>
        <div class="invoice-box">
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Due Date:</strong> ${formattedDueDate}</p>
          <p><strong>Amount Due:</strong></p>
          <p class="amount">${formattedTotal}</p>
        </div>
        <p>Thank you for your business!</p>
        <p>Best regards,<br><strong>${senderName}</strong></p>
      </div>
      <div class="footer"><p>This is an automated invoice email.</p></div>
    </body></html>
  `;

  await transporter.sendMail({
    from: `"${senderBusiness || senderName}" <${process.env.EMAIL_FROM}>`,
    to,
    subject: `Invoice ${invoiceNumber} - ${formattedTotal} due ${formattedDueDate}`,
    html,
    attachments: pdfBuffer ? [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : []
  });
};