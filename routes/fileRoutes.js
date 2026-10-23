const express = require('express');
const multer = require('multer');
const File = require('../models/File');
const { authMiddleware, uploaderOnly } = require('../middleware/auth');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit per file
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed.'), false);
        }
    },
});

// POST /api/files/upload — Upload one or multiple PDFs and store in MongoDB (uploader only)
router.post('/upload', authMiddleware, uploaderOnly, upload.array('pdf', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No PDF file(s) provided.' });
        }

        // Store each PDF binary data directly in MongoDB
        const savedFiles = [];
        for (const f of req.files) {
            const file = await File.create({
                fileName: f.originalname,
                fileData: f.buffer,
                contentType: f.mimetype,
                fileSize: f.size,
                uploadedBy: req.user._id,
            });
            savedFiles.push({
                id: file._id,
                fileName: file.fileName,
                fileSize: file.fileSize,
                uploadDate: file.uploadDate,
            });
        }

        res.status(201).json({
            message: `${savedFiles.length} PDF(s) uploaded successfully!`,
            files: savedFiles,
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

// DELETE /api/files/:id — Delete a single PDF (uploader only)
router.delete('/:id', authMiddleware, uploaderOnly, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'File not found.' });
        }

        await File.findByIdAndDelete(req.params.id);

        res.json({ message: 'File deleted successfully.' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: 'Server error during deletion.' });
    }
});

// POST /api/files/delete-bulk — Delete multiple PDFs at once (uploader only)
router.post('/delete-bulk', authMiddleware, uploaderOnly, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No file IDs provided.' });
        }

        const result = await File.deleteMany({ _id: { $in: ids } });

        res.json({
            message: `${result.deletedCount} file(s) deleted successfully.`,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ message: 'Server error during bulk deletion.' });
    }
});

module.exports = router;

