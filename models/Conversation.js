const mongoose = require("mongoose");
const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    imageUrls: {
      type: [String],
      default: [],
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

    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { _id: false }
);

const ConversationSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    messages: [MessageSchema],
  },
  {
    timestamps: true,
  }
);

ConversationSchema.path("participants").validate((participants) => {
  return Array.isArray(participants) && participants.length === 2;
}, "A conversation must have exactly two participants.");

module.exports = mongoose.model("Conversation", ConversationSchema);
