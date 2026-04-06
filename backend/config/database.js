// Simple in-memory database for testing without MongoDB
class MockDB {
  constructor() {
    this.books = [];
    this.members = [];
    this.loans = [];
    this.users = [];
    this.counters = { books: 0, members: 0, loans: 0, users: 0 };
  }

  // Books
  addBook(bookData) {
    this.counters.books++;
    const book = { _id: `book_${this.counters.books}`, ...bookData, createdAt: new Date(), updatedAt: new Date() };
    this.books.push(book);
    return book;
  }

  getBooks(query = {}) {
    let results = [...this.books];
    if (query.author) results = results.filter(b => b.author.toLowerCase().includes(query.author.toLowerCase()));
    if (query.title) results = results.filter(b => b.title.toLowerCase().includes(query.title.toLowerCase()));
    if (query.category) results = results.filter(b => b.category === query.category);
    if (query.availableCopies) results = results.filter(b => b.availableCopies > 0);
    return results;
  }

  getBookById(id) {
    return this.books.find(b => b._id === id);
  }

  updateBook(id, updates) {
    const index = this.books.findIndex(b => b._id === id);
    if (index === -1) return null;
    this.books[index] = { ...this.books[index], ...updates, updatedAt: new Date() };
    return this.books[index];
  }

  deleteBook(id) {
    const index = this.books.findIndex(b => b._id === id);
    if (index === -1) return false;
    this.books.splice(index, 1);
    return true;
  }

  // Members
  addMember(memberData) {
    this.counters.members++;
    const member = { _id: `member_${this.counters.members}`, ...memberData, createdAt: new Date(), updatedAt: new Date() };
    this.members.push(member);
    return member;
  }

  getMembers(query = {}) {
    let results = [...this.members];
    if (query.name) results = results.filter(m => m.name.toLowerCase().includes(query.name.toLowerCase()));
    if (query.email) results = results.filter(m => m.email.toLowerCase().includes(query.email.toLowerCase()));
    if (query.memberType) results = results.filter(m => m.memberType === query.memberType);
    if (query.membershipStatus) results = results.filter(m => m.membershipStatus === query.membershipStatus);
    return results;
  }

  getMemberById(id) {
    return this.members.find(m => m._id === id);
  }

  updateMember(id, updates) {
    const index = this.members.findIndex(m => m._id === id);
    if (index === -1) return null;
    this.members[index] = { ...this.members[index], ...updates, updatedAt: new Date() };
    return this.members[index];
  }

  deleteMember(id) {
    const index = this.members.findIndex(m => m._id === id);
    if (index === -1) return false;
    this.members.splice(index, 1);
    return true;
  }

  // Users
  addUser(userData) {
    this.counters.users++;
    const user = {
      _id: `user_${this.counters.users}`,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.push(user);
    return user;
  }

  getUsers(query = {}) {
    let results = [...this.users];
    if (query.username) results = results.filter(u => u.username.toLowerCase().includes(query.username.toLowerCase()));
    if (query.email) results = results.filter(u => u.email.toLowerCase().includes(query.email.toLowerCase()));
    if (query.role) results = results.filter(u => u.role === query.role);
    return results;
  }

  getUserById(id) {
    return this.users.find(u => u._id === id);
  }

  updateUser(id, updates) {
    const index = this.users.findIndex(u => u._id === id);
    if (index === -1) return null;
    this.users[index] = { ...this.users[index], ...updates, updatedAt: new Date() };
    return this.users[index];
  }

  deleteUser(id) {
    const index = this.users.findIndex(u => u._id === id);
    if (index === -1) return false;
    this.users.splice(index, 1);
    return true;
  }

  // Loans
  addLoan(loanData) {
    this.counters.loans++;
    const loan = { _id: `loan_${this.counters.loans}`, ...loanData, createdAt: new Date(), updatedAt: new Date() };
    this.loans.push(loan);
    return loan;
  }

  getLoans(query = {}) {
    let results = [...this.loans];
    if (query.status) results = results.filter(l => l.status === query.status);
    if (query.member) results = results.filter(l => l.member === query.member);
    if (query.book) results = results.filter(l => l.book === query.book);
    return results;
  }

  getLoanById(id) {
    return this.loans.find(l => l._id === id);
  }

  updateLoan(id, updates) {
    const index = this.loans.findIndex(l => l._id === id);
    if (index === -1) return null;
    this.loans[index] = { ...this.loans[index], ...updates, updatedAt: new Date() };
    return this.loans[index];
  }

  deleteLoan(id) {
    const index = this.loans.findIndex(l => l._id === id);
    if (index === -1) return false;
    this.loans.splice(index, 1);
    return true;
  }
}

const mockDb = new MockDB();

const useMock = process.env.USE_MOCK_DB === 'true';

const connectDB = async () => {
  if (useMock) {
    console.log('✅ Using Mock Database (in-memory) for testing');
    return mockDb;
  }

  try {
    const mongoose = require('mongoose');
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/librarydb';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('\n⚠️  Options:');
    console.log('1. Install MongoDB: https://www.mongodb.com/try/download/community');
    console.log('2. Use Docker: docker-compose up -d (requires Docker Desktop)');
    console.log('3. Use mock DB: Set USE_MOCK_DB=true in .env file\n');
    process.exit(1);
  }
};

module.exports = { connectDB, mockDb, useMock };