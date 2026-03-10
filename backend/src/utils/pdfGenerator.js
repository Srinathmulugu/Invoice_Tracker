const PDFDocument = require('pdfkit');

exports.generateInvoicePDF = (invoice, client, user) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const currency = invoice.currency || 'USD';
    const formatCurrency = (amount) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

    const PRIMARY = '#4F46E5';
    const LIGHT_GRAY = '#F3F4F6';
    const DARK = '#111827';

    // Header background
    doc.rect(0, 0, doc.page.width, 120).fill(PRIMARY);

    doc.fillColor('white').fontSize(28).font('Helvetica-Bold')
      .text(user.businessName || user.name, 50, 30);

    doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.8)')
      .text(user.businessAddress || '', 50, 65)
      .text(user.email, 50, 80)
      .text(user.phone || '', 50, 95);

    doc.fillColor('white').fontSize(32).font('Helvetica-Bold')
      .text('INVOICE', 350, 35, { align: 'right', width: 200 });

    doc.fontSize(11).font('Helvetica').fillColor('rgba(255,255,255,0.9)')
      .text(`#${invoice.invoiceNumber}`, 350, 75, { align: 'right', width: 200 });

    // Bill To + dates
    const detailsY = 145;
    doc.fillColor(DARK);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6B7280').text('BILL TO', 50, detailsY);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(DARK).text(client.name, 50, detailsY + 15);
    if (client.company) doc.font('Helvetica').text(client.company, 50, detailsY + 30);
    doc.font('Helvetica').fontSize(10).fillColor('#374151').text(client.email, 50, detailsY + (client.company ? 45 : 30));

    const rightX = 350;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6B7280').text('INVOICE DATE', rightX, detailsY);
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
      .text(new Date(invoice.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), rightX, detailsY + 15);

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6B7280').text('DUE DATE', rightX, detailsY + 45);
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
      .text(new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), rightX, detailsY + 60);

    // Table header
    const tableY = 290;
    const col = { desc: 50, qty: 310, rate: 390, amount: 480 };
    doc.rect(50, tableY, doc.page.width - 100, 28).fill(PRIMARY);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('white');
    doc.text('DESCRIPTION', col.desc + 5, tableY + 9);
    doc.text('QTY', col.qty, tableY + 9, { width: 60, align: 'right' });
    doc.text('RATE', col.rate, tableY + 9, { width: 60, align: 'right' });
    doc.text('AMOUNT', col.amount, tableY + 9, { width: 80, align: 'right' });

    // Line items
    let currentY = tableY + 28;
    invoice.lineItems.forEach((item, i) => {
      doc.rect(50, currentY, doc.page.width - 100, 30).fill(i % 2 === 0 ? 'white' : LIGHT_GRAY);
      doc.font('Helvetica').fontSize(10).fillColor(DARK)
        .text(item.description, col.desc + 5, currentY + 9, { width: 240 });
      doc.text(item.quantity.toString(), col.qty, currentY + 9, { width: 60, align: 'right' });
      doc.text(formatCurrency(item.rate), col.rate, currentY + 9, { width: 60, align: 'right' });
      doc.text(formatCurrency(item.amount), col.amount, currentY + 9, { width: 80, align: 'right' });
      currentY += 30;
    });

    doc.rect(50, currentY, doc.page.width - 100, 1).fill('#E5E7EB');
    currentY += 20;

    // Totals
    const totalsX = 350;
    const addRow = (label, value, isTotal = false) => {
      if (isTotal) {
        doc.rect(totalsX - 10, currentY - 5, 220, 32).fill(PRIMARY);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('white')
          .text(label, totalsX, currentY + 4)
          .text(value, totalsX, currentY + 4, { width: 180, align: 'right' });
        currentY += 32;
      } else {
        doc.font('Helvetica').fontSize(10).fillColor(DARK)
          .text(label, totalsX, currentY)
          .text(value, totalsX, currentY, { width: 180, align: 'right' });
        currentY += 20;
      }
    };

    addRow('Subtotal', formatCurrency(invoice.subtotal));
    if (invoice.taxRate > 0) addRow(`Tax (${invoice.taxRate}%)`, formatCurrency(invoice.taxAmount));
    if (invoice.discount > 0) addRow('Discount', `-${formatCurrency(invoice.discount)}`);
    addRow('TOTAL DUE', formatCurrency(invoice.total), true);

    // Notes
    currentY += 30;
    if (invoice.notes) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text('Notes', 50, currentY);
      doc.font('Helvetica').fontSize(10).fillColor('#374151').text(invoice.notes, 50, currentY + 15, { width: 400 });
      currentY += 50;
    }
    if (invoice.terms) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text('Terms & Conditions', 50, currentY);
      doc.font('Helvetica').fontSize(10).fillColor('#374151').text(invoice.terms, 50, currentY + 15, { width: 400 });
    }

    // Footer
    doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill(LIGHT_GRAY);
    doc.font('Helvetica').fontSize(9).fillColor('#6B7280')
      .text(`Thank you for your business! • ${user.businessName || user.name} • ${user.email}`,
        50, doc.page.height - 30, { align: 'center', width: doc.page.width - 100 });

    doc.end();
  });
};