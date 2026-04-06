const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../../middleware/auth');
const auditLogController = require('../../controllers/audit/auditLogController');

router.use(authenticate, authorize('Admin', 'Librarian'));

router.get('/', auditLogController.getAllAuditLogs);
router.get('/:id', auditLogController.getAuditLog);
router.post('/', auditLogController.createAuditLog);
router.put('/:id', auditLogController.updateAuditLog);
router.delete('/:id', auditLogController.deleteAuditLog);

module.exports = router;

