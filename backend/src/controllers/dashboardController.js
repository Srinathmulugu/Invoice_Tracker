const Invoice = require('../models/Invoice');
const Client = require('../models/Client');

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    await Invoice.updateMany(
      { user: userId, status: { $in: ['sent', 'viewed'] }, dueDate: { $lt: now } },
      { status: 'overdue' }
    );

    const statusAgg = await Invoice.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }
    ]);

    const stats = { draft: 0, sent: 0, viewed: 0, paid: 0, overdue: 0, cancelled: 0 };
    const totals = { draft: 0, sent: 0, viewed: 0, paid: 0, overdue: 0, cancelled: 0 };
    statusAgg.forEach(s => {
      if (stats[s._id] !== undefined) {
        stats[s._id] = s.count;
        totals[s._id] = s.total;
      }
    });

    const monthlyRevenue = await Invoice.aggregate([
      { $match: { user: userId, status: 'paid', paidAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
      { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const thisMonthPaid = await Invoice.aggregate([
      { $match: { user: userId, status: 'paid', paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const lastMonthPaid = await Invoice.aggregate([
      { $match: { user: userId, status: 'paid', paidAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const recentInvoices = await Invoice.find({ user: userId })
      .populate('client', 'name company')
      .sort({ createdAt: -1 })
      .limit(5);

    const topClients = await Client.find({ user: userId })
      .sort({ totalInvoiced: -1 })
      .limit(5)
      .select('name company totalInvoiced totalPaid');

    const upcomingDue = await Invoice.find({
      user: userId,
      status: { $in: ['sent', 'viewed'] },
      dueDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
    }).populate('client', 'name').sort({ dueDate: 1 }).limit(5);

    const totalClients = await Client.countDocuments({ user: userId });

    res.json({
      success: true,
      data: {
        statusCounts: stats,
        statusTotals: totals,
        totalOutstanding: totals.sent + totals.viewed + totals.overdue,
        totalPaid: totals.paid,
        totalOverdue: totals.overdue,
        thisMonthRevenue: thisMonthPaid[0]?.total || 0,
        lastMonthRevenue: lastMonthPaid[0]?.total || 0,
        monthlyRevenue,
        recentInvoices,
        topClients,
        upcomingDue,
        totalClients
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};