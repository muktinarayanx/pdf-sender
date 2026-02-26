const express = require('express');
const multer = require('multer');
const File = require('../models/File');
const { authMiddleware, uploaderOnly } = require('../middleware/auth');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed.'), false);
        }
    },
});

// POST /api/files/upload — Upload PDF and store in MongoDB (uploader only)
router.post('/upload', authMiddleware, uploaderOnly, upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No PDF file provided.' });
        }

        // Store PDF binary data directly in MongoDB
        const file = await File.create({
            fileName: req.file.originalname,
            fileData: req.file.buffer,
            contentType: req.file.mimetype,
            fileSize: req.file.size,
            uploadedBy: req.user._id,
        });

        res.status(201).json({
            message: 'PDF uploaded successfully!',
            file: {
                id: file._id,
                fileName: file.fileName,
                fileSize: file.fileSize,
                uploadDate: file.uploadDate,
            },
        });
    } catch (error) {
        console.error('Upload error:', error);
        if (error.message === 'Only PDF files are allowed.') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error during upload.' });
    }
});

// GET /api/files — List all uploaded PDFs (any authenticated user)
// Note: Exclude fileData from the query to keep response fast
router.get('/', authMiddleware, async (req, res) => {
    try {
        const files = await File.find()
            .select('-fileData')
            .populate('uploadedBy', 'name email')
            .sort({ uploadDate: -1 });

        res.json({ files });
    } catch (error) {
        console.error('Fetch files error:', error);
        res.status(500).json({ message: 'Server error fetching files.' });
    }
});

// GET /api/files/download/:id — Download a PDF from MongoDB (any authenticated user)
router.get('/download/:id', authMiddleware, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'File not found.' });
        }

        // Serve the PDF binary from MongoDB with proper headers
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
        res.setHeader('Content-Length', file.fileSize);
        res.send(file.fileData);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Server error during download.' });
    }
});

module.exports = router;
