const AuditLog = require('../../schemas/audit/AuditLog');

exports.getAllAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, action, resourceType } = req.query;
    const query = {};
    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AuditLog.countDocuments(query);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

exports.getAuditLog = async (req, res, next) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, message: 'AuditLog not found' });
    }
    res.status(200).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

exports.createAuditLog = async (req, res, next) => {
  try {
    const payload = { ...req.body, actor: req.user?._id };
    const log = await AuditLog.create(payload);
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

exports.updateAuditLog = async (req, res, next) => {
  try {
    const log = await AuditLog.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!log) {
      return res.status(404).json({ success: false, message: 'AuditLog not found' });
    }
    res.status(200).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

exports.deleteAuditLog = async (req, res, next) => {
  try {
    const log = await AuditLog.findByIdAndDelete(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, message: 'AuditLog not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

