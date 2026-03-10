const cron = require('node-cron');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Client = require('../models/Client');
const { sendDueReminderEmail } = require('../utils/emailService');
const { decryptText } = require('../utils/encryption');

let jobsStarted = false;

const runDueReminders = async () => {
  const now = new Date();
  const reminderDateStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const reminderDateEnd = new Date(reminderDateStart.getTime() + 24 * 60 * 60 * 1000);

  const candidates = await Invoice.find({
    status: { $in: ['sent', 'viewed'] },
    reminderEnabled: true,
    dueDate: { $gte: reminderDateStart, $lt: reminderDateEnd },
    reminderSentAt: { $exists: false }
  }).populate('client').populate('user');

  for (const invoice of candidates) {
    const recipientEmail = decryptText(invoice.client?.email);
    if (!recipientEmail) continue;
    await sendDueReminderEmail({
      to: recipientEmail,
      clientName: invoice.client.name,
      invoiceNumber: invoice.invoiceNumber,
      dueDate: invoice.dueDate,
      total: invoice.total,
      currency: invoice.currency,
      senderName: invoice.user?.name,
      senderBusiness: invoice.user?.businessName
    });
    invoice.reminderSentAt = new Date();
    await invoice.save();
  }
};

const runRecurringInvoices = async () => {
  const now = new Date();
  const recurringTemplates = await Invoice.find({
    'recurring.enabled': true,
    'recurring.nextRunAt': { $lte: now }
  });

  for (const template of recurringTemplates) {
    const user = await User.findById(template.user);
    if (!user) continue;

    const invoiceNumber = `${user.invoicePrefix}-${String(user.nextInvoiceNumber).padStart(4, '0')}`;
    user.nextInvoiceNumber += 1;
    await user.save();

    const newIssueDate = new Date();
    const newDueDate = new Date(newIssueDate);
    newDueDate.setDate(newIssueDate.getDate() + 30);

    await Invoice.create({
      user: template.user,
      client: template.client,
      invoiceNumber,
      status: 'draft',
      issueDate: newIssueDate,
      dueDate: newDueDate,
      lineItems: template.lineItems,
      subtotal: template.subtotal,
      taxRate: template.taxRate,
      taxAmount: template.taxAmount,
      discount: template.discount,
      total: template.total,
      notes: template.notes,
      terms: template.terms,
      currency: template.currency,
      suspicious: template.suspicious,
      riskScore: template.riskScore
    });

    const nextRun = new Date(now);
    const frequency = template.recurring.frequency || 'monthly';
    if (frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
    else if (frequency === 'yearly') nextRun.setFullYear(nextRun.getFullYear() + 1);
    else nextRun.setMonth(nextRun.getMonth() + 1);

    template.recurring.lastRunAt = now;
    template.recurring.nextRunAt = nextRun;
    await template.save();

    await Client.findByIdAndUpdate(template.client, { $inc: { totalInvoiced: template.total } });
  }
};

exports.startAutomationJobs = () => {
  if (jobsStarted) return;
  jobsStarted = true;

  cron.schedule('0 8 * * *', async () => {
    try {
      await runDueReminders();
      await runRecurringInvoices();
    } catch (error) {
      console.error('Automation job failed:', error.message);
    }
  });

  console.log('Automation jobs enabled (due reminders + recurring invoices)');
};
