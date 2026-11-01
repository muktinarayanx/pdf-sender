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

// Helper to extract DD and MM in target timezone (default Asia/Kolkata)
function getDayAndMonth(date = new Date(), timeZone = process.env.TIMEZONE || 'Asia/Kolkata') {
    try {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            day: '2-digit',
            month: '2-digit',
        });
        const parts = formatter.formatToParts(date);
        const day = parts.find(p => p.type === 'day')?.value || String(date.getDate()).padStart(2, '0');
        const month = parts.find(p => p.type === 'month')?.value || String(date.getMonth() + 1).padStart(2, '0');
        return { day, month };
    } catch (e) {
        return {
            day: String(date.getDate()).padStart(2, '0'),
            month: String(date.getMonth() + 1).padStart(2, '0'),
        };
    }
}

// Generate the next auto-renamed filename: "All - DD - MM.pdf" or "All - DD - MM (2).pdf"
async function generateAutoFileName({
    prefix = 'All',
    date = new Date(),
    customDay = null,
    customMonth = null,
    usedInBatch = new Set(),
} = {}) {
    const cleanPrefix = (prefix || 'All').trim();
    const { day: defaultDay, month: defaultMonth } = getDayAndMonth(date);
    const day = (customDay || defaultDay).padStart(2, '0');
    const month = (customMonth || defaultMonth).padStart(2, '0');

    const baseName = `${cleanPrefix} - ${day} - ${month}`;
    const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escapedBase}(\\s*\\((\\d+)\\))?\\.pdf$`, 'i');

    const existingFiles = await File.find({ fileName: regex }).select('fileName');
    const takenIndices = new Set();

    for (const file of existingFiles) {
        const match = file.fileName.match(regex);
        if (match) {
            const index = match[2] ? parseInt(match[2], 10) : 1;
            takenIndices.add(index);
        }
    }

    let nextIndex = 1;
    while (
        takenIndices.has(nextIndex) ||
        usedInBatch.has(nextIndex === 1 ? `${baseName}.pdf` : `${baseName} (${nextIndex}).pdf`)
    ) {
        nextIndex++;
    }

    const resolvedName = nextIndex === 1 ? `${baseName}.pdf` : `${baseName} (${nextIndex}).pdf`;
    usedInBatch.add(resolvedName);
    return resolvedName;
}

// POST /api/files/upload — Upload one or multiple PDFs and store in MongoDB (uploader only)
router.post('/upload', authMiddleware, uploaderOnly, upload.array('pdf', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No PDF file(s) provided.' });
        }

        let customNames = [];
        if (req.body.customNames) {
            try {
                customNames = typeof req.body.customNames === 'string' && req.body.customNames.trim().startsWith('[')
                    ? JSON.parse(req.body.customNames)
                    : (Array.isArray(req.body.customNames) ? req.body.customNames : [req.body.customNames]);
            } catch (err) {
                customNames = [req.body.customNames];
            }
        }

        // Auto-rename is enabled by default unless explicitly disabled
        const autoRenameExplicitlyDisabled = req.body.autoRename === 'false' || req.body.autoRename === false;
        const batchUsedNames = new Set();

        // Store each PDF binary data directly in MongoDB
        const savedFiles = [];
        for (let i = 0; i < req.files.length; i++) {
            const f = req.files[i];
            let resolvedName = customNames[i] && String(customNames[i]).trim()
                ? String(customNames[i]).trim()
                : null;

            // If no custom name was provided (e.g. automated uploads), apply auto-rename system
            if (!resolvedName && !autoRenameExplicitlyDisabled) {
                resolvedName = await generateAutoFileName({
                    prefix: req.body.prefix || 'All',
                    date: new Date(),
                    customDay: req.body.day ? String(req.body.day).trim() : null,
                    customMonth: req.body.month ? String(req.body.month).trim() : null,
                    usedInBatch: batchUsedNames,
                });
            } else if (!resolvedName) {
                resolvedName = f.originalname;
            }

            // Ensure .pdf extension
            if (!resolvedName.toLowerCase().endsWith('.pdf')) {
                resolvedName += '.pdf';
            }

            const file = await File.create({
                fileName: resolvedName,
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

// GET /api/files/view/:id — View a PDF inline for in-browser preview (any authenticated user)
router.get('/view/:id', authMiddleware, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'File not found.' });
        }

        res.setHeader('Content-Type', file.contentType || 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
        res.setHeader('Content-Length', file.fileSize);
        res.send(file.fileData);
    } catch (error) {
        console.error('View error:', error);
        res.status(500).json({ message: 'Server error during view.' });
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

// PATCH /api/files/:id/rename — Rename a single PDF (uploader only)
router.patch('/:id/rename', authMiddleware, uploaderOnly, async (req, res) => {
    try {
        let { newName } = req.body;
        if (!newName || !String(newName).trim()) {
            return res.status(400).json({ message: 'New filename is required.' });
        }
        newName = String(newName).trim();
        if (!newName.toLowerCase().endsWith('.pdf')) {
            newName += '.pdf';
        }

        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'File not found.' });
        }

        file.fileName = newName;
        await file.save();

        res.json({
            message: `File renamed to "${newName}" successfully!`,
            file: {
                id: file._id,
                fileName: file.fileName,
                fileSize: file.fileSize,
                uploadDate: file.uploadDate,
            },
        });
    } catch (error) {
        console.error('Rename error:', error);
        res.status(500).json({ message: 'Server error during rename.' });
    }
});

// POST /api/files/auto-rename-all — Auto-rename existing legacy files to "All - DD - MM" format based on uploadDate (uploader only)
router.post('/auto-rename-all', authMiddleware, uploaderOnly, async (req, res) => {
    try {
        const prefix = (req.body.prefix || 'All').trim();
        // Fetch all files sorted chronologically by uploadDate ascending
        const files = await File.find().sort({ uploadDate: 1 });

        const dateCounters = {};
        const updatedFiles = [];

        for (const file of files) {
            const { day, month } = getDayAndMonth(file.uploadDate);
            const dateKey = `${prefix} - ${day} - ${month}`;

            if (!dateCounters[dateKey]) {
                dateCounters[dateKey] = 0;
            }
            dateCounters[dateKey]++;

            const count = dateCounters[dateKey];
            const targetName = count === 1 ? `${dateKey}.pdf` : `${dateKey} (${count}).pdf`;

            if (file.fileName !== targetName) {
                const oldName = file.fileName;
                file.fileName = targetName;
                await file.save();
                updatedFiles.push({ id: file._id, oldName, newName: targetName });
            }
        }

        res.json({
            message: `Auto-renamed ${updatedFiles.length} file(s) to "${prefix} - DD - MM" format.`,
            count: updatedFiles.length,
            updatedFiles,
        });
    } catch (error) {
        console.error('Auto-rename all error:', error);
        res.status(500).json({ message: 'Server error during batch auto-rename.' });
    }
});

module.exports = router;


