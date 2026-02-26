const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true,
    },
    fileData: {
        type: Buffer,
        required: true,
    },
    contentType: {
        type: String,
        default: 'application/pdf',
    },
    fileSize: {
        type: Number,
        required: true,
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    uploadDate: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('File', fileSchema);
