# PDF Sender — Cloud PDF Sharing

A full-stack PDF sharing website with JWT authentication, Cloudinary cloud storage, and MongoDB Atlas.

## Features

- **Two user roles**: Uploader (Admin) and Downloader (User)
- **JWT authentication** with bcrypt password hashing
- **Cloudinary** cloud storage for PDFs
- **MongoDB Atlas** for file metadata
- **Drag & drop** upload with PDF-only filter (10 MB limit)
- **Dark themed**, responsive UI

## Folder Structure

```
pdf-sender/
├── config/
│   ├── db.js              # MongoDB connection
│   └── cloudinary.js      # Cloudinary SDK config
├── middleware/
│   └── auth.js            # JWT auth & role guard
├── models/
│   ├── User.js            # User schema
│   └── File.js            # File metadata schema
├── routes/
│   ├── authRoutes.js      # POST /register, /login
│   └── fileRoutes.js      # POST /upload, GET /files, /download/:id
├── public/
│   ├── index.html         # Frontend page
│   ├── style.css          # Styles
│   └── app.js             # Frontend logic
├── .env.example           # Environment variables template
├── server.js              # Express entry point
└── package.json
```

## Setup

### 1. Install dependencies

```bash
cd pdf-sender
npm install
```

### 2. Create `.env` file

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/pdf-sender
JWT_SECRET=your_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Start the server

```bash
npm start
```

Open **http://localhost:5000** in your browser.

## API Endpoints

| Method | Route                  | Auth     | Description              |
|--------|------------------------|----------|--------------------------|
| POST   | `/api/auth/register`   | Public   | Register a new user      |
| POST   | `/api/auth/login`      | Public   | Login and receive JWT     |
| POST   | `/api/files/upload`    | Uploader | Upload a PDF to Cloudinary|
| GET    | `/api/files`           | Any user | List all uploaded PDFs    |
| GET    | `/api/files/download/:id` | Any user | Download a PDF         |
