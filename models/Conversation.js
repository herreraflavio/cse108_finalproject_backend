// models/Conversation.js

const mongoose = require("mongoose");
const { Schema } = mongoose;

/** Sub-document schema for each chat message */
const MessageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    // optional: track who has read this message
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { _id: false }
);

/** Main schema: one document per conversation */
const ConversationSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ], // expect exactly 2 entries here
    messages: [MessageSchema],
  },
  {
    timestamps: true, // adds createdAt / updatedAt
  }
);

// ensure we only ever have two participants per conversation
ConversationSchema.path("participants").validate((participants) => {
  return Array.isArray(participants) && participants.length === 2;
}, "A conversation must have exactly two participants.");

module.exports = mongoose.model("Conversation", ConversationSchema);
