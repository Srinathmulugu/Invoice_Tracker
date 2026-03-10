const Tesseract = require('tesseract.js');

const extractByRegex = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    for (let i = match.length - 1; i >= 1; i -= 1) {
      if (match[i]) return match[i].trim();
    }
  }
  return '';
};

exports.extractInvoiceFields = async ({ imageBuffer, rawText }) => {
  const text = rawText || (await Tesseract.recognize(imageBuffer, 'eng')).data.text;

  const invoiceNumber = extractByRegex(text, [
    /invoice\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
    /inv\s*[:\-]?\s*([A-Z0-9\-\/]+)/i
  ]);

  const gstNumber = extractByRegex(text, [
    /(?:GSTIN|GST)\s*[:\-]?\s*([0-9A-Z]{10,20})/i,
    /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])\b/
  ]);

  const amount = extractByRegex(text, [
    /(?:total\s*(?:amount)?|grand\s*total)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /amount\s*due\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/i
  ]);

  const date = extractByRegex(text, [
    /(?:invoice\s*date|date)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i
  ]);

  const normalizedAmount = Number(String(amount).replace(/,/g, '')) || 0;

  return {
    invoiceNumber,
    gstNumber,
    amount: normalizedAmount,
    date,
    rawText: text
  };
};
