const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    prompt: { type: String },
    intent: { type: String },
    provider: { type: String },
    text: { type: String },
    code: { type: String },
    folder: { type: String },
    files: [{ type: String }],
    explanation: { type: String },
    summary: { type: String },
  },
  { timestamps: true }
);

const chatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    messages: [messageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Chat', chatSchema);

