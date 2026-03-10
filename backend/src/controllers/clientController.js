const Client = require('../models/Client');
const Invoice = require('../models/Invoice');

exports.getClients = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const query = { user: req.user._id };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Client.countDocuments(query);
    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({ success: true, data: clients, total, pages: Math.ceil(total / limit), page: Number(page) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClient = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, user: req.user._id });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const invoices = await Invoice.find({ client: client._id, user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, data: client, invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createClient = async (req, res) => {
  try {
    const client = await Client.create({ ...req.body, user: req.user._id });
    res.status(201).json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, user: req.user._id });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const invoiceCount = await Invoice.countDocuments({ client: req.params.id });
    if (invoiceCount > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete client with existing invoices' });
    }

    await client.deleteOne();
    res.json({ success: true, message: 'Client deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};