/**
 * Async handler utility to wrap controller functions
 * This separates business logic from HTTP response handling
 * 
 * Usage:
 * const asyncHandler = require('./utils/asyncHandler');
 * 
 * exports.getBooks = asyncHandler(async (req) => {
 *   const books = await Book.find();
 *   return { success: true, data: books };
 * });
 */
const { ok, fail } = require('./apiResponse');

const asyncHandler = (controllerFn) => {
  return async (req, res, next) => {
    try {
      // Call the controller function which returns data
      const result = await controllerFn(req, res, next);
      
      // If controller returns nothing, send empty response
      if (result === undefined || result === null) {
        return res.status(200).json(ok('Success'));
      }
      
      // If controller returns an object with statusCode, use it
      if (result.statusCode) {
        const statusCode = result.statusCode;
        delete result.statusCode;
        
        // Determine if it's a success or failure based on success flag
        if (result.success === false) {
          return res.status(statusCode).json(fail(result.message || 'Error', result.data));
        }
        return res.status(statusCode).json(ok(result.message || 'Success', result.data));
      }
      
      // Default success response
      if (result.success === false) {
        return res.status(400).json(fail(result.message || 'Error', result.data));
      }
      
      return res.status(200).json(ok(result.message || 'Success', result.data));
    } catch (error) {
      next(error);
    }
  };
};

module.exports = asyncHandler;