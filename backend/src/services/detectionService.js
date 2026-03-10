const Invoice = require('../models/Invoice');

exports.calculateFraudSignals = async ({ userId, total, ignoreInvoiceId }) => {
  const match = { user: userId };
  if (ignoreInvoiceId) {
    match._id = { $ne: ignoreInvoiceId };
  }

  const stats = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        avgTotal: { $avg: '$total' },
        count: { $sum: 1 }
      }
    }
  ]);

  const avgTotal = stats[0]?.avgTotal || 0;
  const riskScore = avgTotal > 0 ? Math.min(100, Math.round((total / avgTotal) * 20)) : 0;
  const suspicious = avgTotal > 0 && total > avgTotal * 3;

  return {
    avgTotal,
    riskScore,
    suspicious
  };
};
