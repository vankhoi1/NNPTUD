# Library Management System - RESTful API

A complete backend API for library management built with Node.js, Express, and MongoDB following a RESTful layered structure.

## Features

- **RESTful API** design with proper HTTP methods and status codes
- **RESTful Layered Structure** (bin, routes, controllers, schemas, utils)
- **MongoDB** with Mongoose ODM for data modeling
- **Docker** support for easy deployment
- **Input validation** using express-validator
- **Error handling** middleware
- **Pagination** support for all list endpoints
- **Search and filtering** capabilities
- **CRUD operations** for Books, Members, and Loans
- **JWT Authentication** with role-based authorization (Admin, Librarian, Reader)
- **Image-based book search** (mock implementation ready for AI integration)
- **Self-service borrowing** for readers
- **Fine calculation** for overdue books ($0.50/day)

## Project Structure

```
bai_cuoi_ki/
├── bin/
│   └── www.js               # Server bootstrap
├── config/
│   └── database.js          # Database connection configuration
├── controllers/
│   ├── auth/
│   │   └── authController.js    # Authentication endpoints
│   ├── book/
│   │   └── bookController.js
│   ├── member/
│   │   └── memberController.js
│   └── loan/
│       └── loanController.js
├── schemas/
│   ├── book/
│   │   └── Book.js
│   ├── member/
│   │   └── Member.js
│   ├── user/
│   │   └── User.js              # User schema for authentication
│   └── loan/
│       └── Loan.js
├── routes/
│   ├── auth/
│   │   └── authRoutes.js        # Authentication routes
│   ├── book/
│   │   └── bookRoutes.js
│   ├── member/
│   │   └── memberRoutes.js
│   └── loan/
│       └── loanRoutes.js
├── middleware/
│   ├── auth.js                  # JWT authentication & authorization
│   ├── errorHandler.js      # Global error handling
│   └── validation.js        # Validation middleware
├── utils/
│   └── apiResponse.js           # Consistent API response helpers
├── uploads/                     # Image upload directory
├── .env                     # Environment variables
├── .gitignore
├── app.js                   # Express app setup (no listen here)
├── docker-compose.yml       # Docker composition
├── Dockerfile              # Docker configuration
├── mongo-init.js           # MongoDB initialization script
└── package.json
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4+) or Docker Desktop
- npm or yarn

## Installation

### Option 1: Using Docker (Recommended)

1. Install Docker Desktop from https://www.docker.com/products/docker-desktop

2. Start Docker Desktop

3. Run the application with Docker Compose:
```bash

```docker-compose up -d

This will start:
- MongoDB on port 27017
- Node.js application on port 3000

4. To stop:
```bash
docker-compose down
```

### Option 2: Local Installation

1. Install MongoDB locally or use MongoDB Atlas (cloud)

2. Clone or download the project

3. Install dependencies:
```bash
npm install
```

4. Configure environment variables in `.env` file:
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/librarydb
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters-long
JWT_EXPIRES_IN=7d
USE_MOCK_DB=true
```

5. Start MongoDB service (if running locally)

6. Start the application:
```bash
npm start
# or for development with auto-reload
npm run dev
```

## API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Health Check
- `GET /api/health` - Check API status

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /auth/register | Register new user | Public |
| POST | /auth/login | Login user | Public |
| GET | /auth/me | Get current user profile | Private |

### Books
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /books | Get all books (with pagination & filtering) | Public |
| GET | /books/:id | Get single book | Public |
| POST | /books | Create a new book | Admin/Librarian |
| PUT | /books/:id | Update a book | Admin/Librarian |
| DELETE | /books/:id | Delete a book | Admin/Librarian |
| GET | /books/search | Search books by criteria | Public |
| POST | /books/search-by-image | Search books by image upload | Public |

### Members
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /members | Get all members (with pagination & filtering) | Admin/Librarian |
| GET | /members/:id | Get single member | Admin/Librarian |
| GET | /members/:id/loans | Get member's loan history | Admin/Librarian |
| POST | /members | Create a new member | Admin/Librarian |
| PUT | /members/:id | Update a member | Admin/Librarian |
| PATCH | /members/:id/status | Update member status | Admin/Librarian |
| DELETE | /members/:id | Delete a member | Admin/Librarian |

### Loans
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /loans | Get all loans (with pagination & filtering) | Public |
| GET | /loans/overdue | Get all overdue loans | Public |
| GET | /loans/:id | Get single loan | Public |
| POST | /loans | Create a new loan (borrow book) | Admin/Librarian |
| PUT | /loans/:id | Update a loan | Admin/Librarian |
| PUT | /loans/:id/return | Return a book | Admin/Librarian/Reader |
| PUT | /loans/:id/renew | Renew a loan | Admin/Librarian |
| DELETE | /loans/:id | Delete a loan | Admin/Librarian |
| GET | /loans/me/loans | Get current user's loans | Reader |
| POST | /loans/borrow | Borrow a book (self-service) | Reader/Librarian/Admin |

## Query Parameters

### Pagination (for list endpoints)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)

### Filtering Examples
- Books: `?author= Tolkien&category=Fiction&available=true`
- Members: `?name=Nguyen&memberType=Student&membershipStatus=Active`
- Loans: `?status=Borrowed&overdue=true`

## Request Examples

### Register a User
```json
POST /api/auth/register
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "Reader",
  "memberId": "optional-existing-member-id"
}
```

### Login
```json
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Create a Book
```json
POST /api/books
{
  "title": "The Hobbit",
  "author": "J.R.R. Tolkien",
  "isbn": "978-0547928227",
  "publisher": "Houghton Mifflin",
  "publishYear": 1937,
  "category": "Fiction",
  "totalCopies": 5,
  "description": "A fantasy novel"
}
```

### Create a Member
```json
POST /api/members
{
  "name": "Nguyen Van A",
  "email": "nguyenvana@example.com",
  "phone": "0912345678",
  "address": "123 Main St, Hanoi",
  "memberType": "Student"
}
```

### Borrow a Book (Admin/Librarian)
```json
POST /api/loans
{
  "bookId": "64d5f8a7b8e4c2d5f6a7b8c9",
  "memberId": "64d5f8a7b8e4c2d5f6a7b8d0",
  "dueDate": "2024-12-31T23:59:59.000Z",
  "notes": "Please take care of this book"
}
```

### Borrow a Book (Self-Service for Readers)
```json
POST /api/loans/borrow
{
  "bookId": "64d5f8a7b8e4c2d5f6a7b8c9",
  "dueDate": "2024-12-31T23:59:59.000Z",
  "notes": "Optional notes"
}
```

### Return a Book
```json
PUT /api/loans/:id/return
{
  "notes": "Book returned in good condition"
}
```

### Search Books by Image
```bash
curl -X POST http://localhost:3000/api/books/search-by-image \
  -F "image=@book-cover.jpg"
```

## Authentication & Authorization

The system uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles

1. **Admin**: Full access to all operations
2. **Librarian**: Can manage books, members, and loans (except user management)
3. **Reader**: Can view books, search, borrow/return own books, view personal loan history

### Role-Based Access Control

- **Public endpoints**: No authentication required (view books, search)
- **Protected endpoints**: Require authentication with appropriate role
- **Self-service**: Readers can only access their own loan data

## Business Rules

1. **Book Borrowing:**
   - Member must have Active status
   - Member must have available borrowing capacity (current < max)
   - Book must have available copies (> 0)
   - Member cannot borrow the same book if already borrowed

2. **Book Returning:**
   - Automatically updates available copies
   - Decreases member's borrowed count
   - Calculates fine if overdue ($0.50/day)
   - Updates loan status to Returned

3. **Automatic Status Updates:**
   - Loans are checked for overdue status on operations
   - Overdue loans have fine automatically calculated

4. **Image Search:**
   - Currently uses mock implementation returning random available books
   - Ready for integration with AI/ML services (Google Vision, AWS Rekognition, etc.)
   - Accepts image files (jpeg, jpg, png, gif) up to 5MB

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "error": "Error message",
  "stack": "Stack trace (only in development)"
}
```

Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Development

### Running in Development Mode
```bash
npm run dev
```

This uses nodemon to automatically restart the server on file changes.

### Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/librarydb
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters-long
JWT_EXPIRES_IN=7d
USE_MOCK_DB=true
```

## Testing the API

### Using cURL

1. Register a user:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123","role":"Reader"}'
```

2. Login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

3. Get profile (with token):
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <your-token>"
```

4. Create a book (Admin/Librarian):
```bash
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"title":"Test Book","author":"Test Author","isbn":"1234567890","category":"Fiction","totalCopies":3}'
```

5. Borrow a book (Reader self-service):
```bash
curl -X POST http://localhost:3000/api/loans/borrow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"bookId":"<book_id>","dueDate":"2024-12-31"}'
```

6. Search by image:
```bash
curl -X POST http://localhost:3000/api/books/search-by-image \
  -F "image=@book-cover.jpg"
```

### Using Postman/Insomnia

Import the collection and set the base URL to `http://localhost:3000/api`

## Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build
```

## Security Features

- Helmet.js for security headers
- CORS enabled
- Input validation on all endpoints
- NoSQL injection prevention with Mongoose
- JWT authentication with role-based authorization
- Environment variables for sensitive data
- Password hashing with bcrypt

## Frontend

The frontend is located in the `frontend/` directory and provides:

- User authentication (login/register)
- Role-based UI adaptation
- Book management (CRUD)
- Member management (CRUD)
- Loan management (create, return, renew)
- Self-service borrowing for readers
- Image-based book search
- Responsive design

To use the frontend:
1. Open `frontend/index.html` in a browser
2. Ensure the backend is running on `http://localhost:3000`
3. Login with your credentials or register a new account

## Future Enhancements

- Real image recognition integration with AI/ML services
- Email notifications for due dates
- Advanced reporting and analytics
- Book reservation system
- Fine payment tracking
- API documentation with Swagger/OpenAPI
- Unit and integration tests
- WebSocket for real-time notifications

## License

MIT

## Author

Library Management System - Academic Project

## Quick Start Guide

### First Time Setup:

1. **Start the backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Access the frontend:**
   - Open `frontend/index.html` in your web browser

3. **Create an Admin account:**
   - Click "Login" and then "Register here"
   - Register with role "Admin"
   - Login with your credentials

4. **Add sample data:**
   - Add some books using "Add New Book" button
   - Add members using "Add New Member" button

5. **Test borrowing:**
   - Create a member with role "Reader"
   - Login as that reader
   - Borrow books using the "Borrow" button on book rows

6. **Test image search:**
   - Click "Search by Image" button in Books section
   - Upload any image file
   - System will return mock results (ready for AI integration)

## Notes

- The system supports both real MongoDB and an in-memory mock database (set `USE_MOCK_DB=true` in `.env`)
- For production, ensure to change the `JWT_SECRET` to a strong random string
- Image uploads are stored in the `backend/uploads/` directory
- The image search is currently a mock implementation that can be replaced with actual AI/ML services