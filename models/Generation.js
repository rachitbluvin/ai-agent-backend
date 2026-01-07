const mongoose = require('mongoose');

const generationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    prompt: { type: String, required: true },
    provider: { type: String, required: true },
    code: { type: String, required: true },
    explanation: { type: String },
    folder: { type: String },
    files: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Generation', generationSchema);
