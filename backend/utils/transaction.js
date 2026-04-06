const mongoose = require('mongoose');

// Tag business logic errors so they are NOT retried in fallback
class BusinessError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'BusinessError';
    this.statusCode = statusCode || 400;
  }
}

/**
 * Run work inside MongoDB transaction (Mongoose session).
 * If MongoDB/cluster does not support transactions, fallback to run without session.
 * Business errors (tagged with BusinessError) are never retried.
 */
async function runInTransaction(work) {
  // Mock DB mode: no transactions
  if (process.env.USE_MOCK_DB === 'true') {
    return work(undefined);
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    // Business logic errors should NOT be retried without session
    if (err.name === 'BusinessError' || err.statusCode) {
      throw err;
    }
    // Transaction/connection errors: fallback without session so demo works
    try {
      return await work(undefined);
    } catch (fallbackErr) {
      throw fallbackErr;
    }
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (_) {
        // ignore
      }
    }
  }
}

module.exports = { runInTransaction, BusinessError };
