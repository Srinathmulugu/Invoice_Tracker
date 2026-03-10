const User = require('../models/User');

const sendTokenResponse = (user, statusCode, res) => {
  const token = user.generateToken();
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      businessName: user.businessName,
      businessAddress: user.businessAddress,
      phone: user.phone,
      currency: user.currency,
      taxRate: user.taxRate,
      invoicePrefix: user.invoicePrefix
    }
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, businessName } = req.body;
    const user = await User.create({ name, email, password, businessName });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

exports.updateProfile = async (req, res) => {
  try {
    const fields = ['name', 'businessName', 'businessAddress', 'phone', 'currency', 'taxRate', 'paymentTerms', 'invoicePrefix'];
    const updateData = {};
    fields.forEach(field => { if (req.body[field] !== undefined) updateData[field] = req.body[field]; });

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};