const Book = require('../../schemas/book/Book');
const fs = require('fs');
const path = require('path');
const asyncHandler = require('../../utils/asyncHandler');

// @desc    Get all books with optional filtering
// @route   GET /api/books
// @access  Public
exports.getAllBooks = asyncHandler(async (req) => {
  const {
    page = 1,
    limit = 10,
    author,
    category,
    title,
    available
  } = req.query;

  const query = {};

  if (author) query.author = { $regex: author, $options: 'i' };
  if (category) query.category = category;
  if (title) query.title = { $regex: title, $options: 'i' };
  if (available === 'true') query.availableCopies = { $gt: 0 };

  const books = await Book.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Book.countDocuments(query);

  return {
    success: true,
    count: books.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: books
  };
});

// @desc    Get single book by ID
// @route   GET /api/books/:id
// @access  Public
exports.getBook = asyncHandler(async (req) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    return {
      success: false,
      message: `Book not found with id of ${req.params.id}`,
      statusCode: 404
    };
  }

  return {
    success: true,
    data: book
  };
});

// @desc    Create a new book
// @route   POST /api/books
// @access  Private/Admin
exports.createBook = asyncHandler(async (req) => {
  const payload = { ...req.body };
  // Khi them sach moi: mặc định số còn lại = tổng số (nếu FE không gửi availableCopies)
  if (payload.availableCopies === undefined && payload.totalCopies !== undefined) {
    payload.availableCopies = payload.totalCopies;
  }
  const book = await Book.create(payload);

  return {
    success: true,
    data: book,
    statusCode: 201
  };
});

// @desc    Update a book
// @route   PUT /api/books/:id
// @access  Private/Admin
exports.updateBook = asyncHandler(async (req) => {
  // First, get the current book to know existing quantities
  const currentBook = await Book.findById(req.params.id);
  
  if (!currentBook) {
    return {
      success: false,
      message: `Book not found with id of ${req.params.id}`,
      statusCode: 404
    };
  }

  // Create a copy of the update data
  const updateData = { ...req.body };

  // If totalCopies is being updated, calculate the difference and add to availableCopies
  if (updateData.totalCopies !== undefined) {
    const quantityDifference = updateData.totalCopies - currentBook.totalCopies;
    
    // If we're adding more copies (positive difference), add to availableCopies
    if (quantityDifference > 0) {
      updateData.availableCopies = currentBook.availableCopies + quantityDifference;
    }
    // If we're removing copies (negative difference), adjust availableCopies but don't go below 0
    else if (quantityDifference < 0) {
      const reduction = Math.abs(quantityDifference);
      // Ensure we don't remove more copies than are available
      const newAvailable = Math.max(0, currentBook.availableCopies - reduction);
      updateData.availableCopies = newAvailable;
    }
    // If quantityDifference is 0, no change needed
  }

  // Update the book with the modified data
  const book = await Book.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  });

  return {
    success: true,
    data: book,
    message: updateData.totalCopies !== undefined ?
      `Book quantity updated. Total copies: ${book.totalCopies}, Available copies: ${book.availableCopies}` :
      'Book updated successfully'
  };
});

// @desc    Delete a book
// @route   DELETE /api/books/:id
// @access  Private/Admin
exports.deleteBook = asyncHandler(async (req) => {
  const book = await Book.findByIdAndDelete(req.params.id);

  if (!book) {
    return {
      success: false,
      message: `Book not found with id of ${req.params.id}`,
      statusCode: 404
    };
  }

  return {
    success: true,
    data: {}
  };
});

// @desc    Search books by multiple criteria
// @route   GET /api/books/search
// @access  Public
exports.searchBooks = asyncHandler(async (req) => {
  const { author, title, category, publisher } = req.query;
  const query = {};

  if (author) query.author = { $regex: author, $options: 'i' };
  if (title) query.title = { $regex: title, $options: 'i' };
  if (category) query.category = category;
  if (publisher) query.publisher = { $regex: publisher, $options: 'i' };

  const books = await Book.find(query).sort({ createdAt: -1 });

  return {
    success: true,
    count: books.length,
    data: books
  };
});

// @desc    Search books by image (mock implementation)
// @route   POST /api/books/search-by-image
// @access  Public
exports.searchByImage = asyncHandler(async (req) => {
  // Check if file was uploaded
  if (!req.file) {
    return {
      success: false,
      message: 'Please upload an image file',
      statusCode: 400
    };
  }

  // Mock implementation - in real scenario, you would use image recognition API
  const mockResults = [
    {
      _id: 'mock1',
      title: 'Sample Book 1',
      author: 'Author 1',
      isbn: '1234567890',
      coverImage: '/uploads/mock-cover1.jpg'
    },
    {
      _id: 'mock2',
      title: 'Sample Book 2',
      author: 'Author 2',
      isbn: '0987654321',
      coverImage: '/uploads/mock-cover2.jpg'
    }
  ];

  return {
    success: true,
    message: 'Image search completed (mock implementation)',
    data: mockResults
  };
});

// @desc    Upload book cover image
// @route   POST /api/books/:id/upload-cover
// @access  Private/Admin
exports.uploadBookCover = asyncHandler(async (req) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    return {
      success: false,
      message: `Book not found with id of ${req.params.id}`,
      statusCode: 404
    };
  }

  if (!req.file) {
    return {
      success: false,
      message: 'Please upload an image file',
      statusCode: 400
    };
  }

  // Update book with cover image path
  book.coverImage = `/uploads/${req.file.filename}`;
  await book.save();

  return {
    success: true,
    data: book,
    message: 'Book cover uploaded successfully'
  };
});
