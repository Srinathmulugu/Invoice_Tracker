const express = require('express');
const router = express.Router();
const { getClients, getClient, createClient, updateClient, deleteClient } = require('../controllers/clientController');
const { protect, authorizeRoles } = require('../middleware/auth');

router.use(protect);
router.get('/', getClients);
router.post('/', authorizeRoles('admin', 'accountant'), createClient);
router.get('/:id', getClient);
router.put('/:id', authorizeRoles('admin', 'accountant'), updateClient);
router.delete('/:id', authorizeRoles('admin'), deleteClient);

module.exports = router;