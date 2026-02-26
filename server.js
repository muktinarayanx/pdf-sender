const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const File = require('./models/File');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Fallback — serve index.html for any unknown route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Auto-cleanup: Delete PDFs older than 3 days
async function cleanupOldFiles() {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const result = await File.deleteMany({ uploadDate: { $lt: threeDaysAgo } });
        if (result.deletedCount > 0) {
            console.log(`Cleanup: Deleted ${result.deletedCount} PDF(s) older than 3 days.`);
        }
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });

    // Run cleanup on startup and then every hour
    cleanupOldFiles();
    setInterval(cleanupOldFiles, 60 * 60 * 1000);
});
