const express = require('express');
const router = express.Router();
const { getDashboardStats, getAiInsights, createCloudBackup } = require('../controllers/dashboardController');
const { protect, authorizeRoles } = require('../middleware/auth');

router.get('/stats', protect, getDashboardStats);
router.get('/insights', protect, getAiInsights);
router.post('/backup', protect, authorizeRoles('admin'), createCloudBackup);

module.exports = router;