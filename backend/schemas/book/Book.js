// Book schema - works with both MongoDB and Mock DB
const { useMock, mockDb } = require('../../config/database');

let Book;

if (!useMock) {
  const mongoose = require('mongoose');

  const bookSchema = new mongoose.Schema({
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
      maxlength: [100, 'Author name cannot exceed 100 characters']
    },
    isbn: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true
    },
    publisher: {
      type: String,
      trim: true,
      maxlength: [100, 'Publisher name cannot exceed 100 characters']
    },
    publishYear: {
      type: Number,
      min: [1800, 'Publish year must be after 1800'],
      max: [new Date().getFullYear() + 1, 'Publish year cannot be in the far future']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      enum: {
        values: ['Fiction', 'Non-Fiction', 'Science', 'Technology', 'History', 'Biography', 'Children', 'Education', 'Other'],
        message: 'Please select a valid category'
      }
    },
    totalCopies: {
      type: Number,
      required: [true, 'Total copies is required'],
      min: [1, 'Total copies must be at least 1'],
      default: 1
    },
    availableCopies: {
      type: Number,
      required: true,
      min: [0, 'Available copies cannot be negative'],
      default: 1
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    holdsCount: {
      type: Number,
      required: true,
      min: [0, 'Holds count cannot be negative'],
      default: 0
    }
  }, {
    timestamps: true
  });

  bookSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
  });

  bookSchema.methods.isAvailable = function() {
    return this.availableCopies > 0;
  };

  bookSchema.methods.decreaseAvailable = function() {
    if (this.availableCopies > 0) {
      this.availableCopies -= 1;
      return true;
    }
    return false;
  };

  bookSchema.methods.increaseAvailable = function() {
    this.availableCopies += 1;
    return true;
  };

  bookSchema.methods.increaseHolds = function() {
    this.holdsCount += 1;
    return true;
  };

  bookSchema.methods.decreaseHolds = function() {
    if (this.holdsCount > 0) {
      this.holdsCount -= 1;
      return true;
    }
    return false;
  };

  Book = mongoose.model('Book', bookSchema);
} else {
  class Book {
    constructor(data) {
      this._id = `book_${mockDb.counters.books++}`;
      this.title = data.title;
      this.author = data.author;
      this.isbn = data.isbn;
      this.publisher = data.publisher || '';
      this.publishYear = data.publishYear || null;
      this.category = data.category;
      this.totalCopies = data.totalCopies || 1;
      this.availableCopies = data.availableCopies !== undefined ? data.availableCopies : this.totalCopies;
      this.description = data.description || '';
      this.holdsCount = data.holdsCount || 0;
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }

    save() {
      mockDb.books.push(this);
      return Promise.resolve(this);
    }

    static find(query = {}) {
      return Promise.resolve(mockDb.getBooks(query));
    }

    static findById(id) {
      return Promise.resolve(mockDb.getBookById(id));
    }

    static findOneAndUpdate(filter, update) {
      const book = mockDb.getBookById(filter._id || filter.id);
      if (!book) return Promise.resolve(null);
      if (update.$set) {
        Object.assign(book, update.$set, { updatedAt: new Date() });
      } else {
        Object.assign(book, update, { updatedAt: new Date() });
      }
      return Promise.resolve(book);
    }

    static findByIdAndDelete(id) {
      const success = mockDb.deleteBook(id);
      return Promise.resolve(success ? { _id: id } : null);
    }

    static countDocuments(query = {}) {
      return Promise.resolve(mockDb.getBooks(query).length);
    }
  }
}

module.exports = Book;
