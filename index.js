require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// Models
const User = require("./models/User");
const Conversation = require("./models/Conversation");

const app = express();
app.set("trust proxy", 1);

// ————————————————
// HTTP + WebSocket setup
// ————————————————
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://cse108.flavioherrera.com",
      "https://cse108-finalproject-frontend.vercel.app",
    ],
    credentials: true,
  },
});

// ————————————————
// CORS + JSON + Static
// ————————————————
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://cse108.flavioherrera.com",
      "https://cse108-finalproject-frontend.vercel.app",
    ],
    credentials: true,
  })
);
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(express.json());
app.use(cookieParser());

// ————————————————
// MongoDB
// ————————————————
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB Atlas");
    initCounter();
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ————————————————
// Session (for your REST routes)
// ————————————————
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24,
  },
});
app.use(sessionMiddleware);

// ————————————————
// Auth guard for REST
// ————————————————
const ensureAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

// start conter
const UploadCounter = require("./models/UploadCounter");

async function initCounter() {
  const exists = await UploadCounter.findOne({ name: "global" });
  if (!exists) {
    await UploadCounter.create({ name: "global", count: 0 });
    console.log("📦 Upload counter initialized");
  } else {
    console.log("ℹ️ Upload counter already exists");
  }
}

// ————————————————
// Your existing REST routes
// ————————————————
app.use("/test", ensureAuth, require("./routes/test"));
app.use("/auth/register", require("./routes/auth/Register"));
app.use("/auth/login", require("./routes/auth/Login"));
app.use("/auth/logout", ensureAuth, require("./routes/auth/Logout"));
app.use("/auth/profile", ensureAuth, require("./routes/auth/Profile"));
app.use("/posts/post", ensureAuth, require("./routes/posts/Post"));
app.use("/user/follow", ensureAuth, require("./routes/user/Follow"));
app.use("/user/unfollow", ensureAuth, require("./routes/user/Unfollow"));
app.use("/user/feed", ensureAuth, require("./routes/user/Feed"));
app.use(
  "/search/recommendations",
  ensureAuth,
  require("./routes/search/Recomendations")
);
app.use(
  "/search/userprofile",
  ensureAuth,
  require("./routes/search/UserProfile")
);
app.use("/search/self", ensureAuth, require("./routes/search/UserProfile"));
app.use("/uploads/images", ensureAuth, require("./routes/uploads/Images"));

// Simple “who am I?” endpoint
app.get("/me", ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select(
      "_id username role"
    );
    if (!user) return res.status(404).send("User not found.");
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error.");
  }
});

// ————————————————
// Chat history: paginated
// GET /api/chats/:userId?page=1
// ————————————————
// server.js (or your routes file)

app.get("/api/chats/:userId", ensureAuth, async (req, res) => {
  const otherUserId = req.params.userId;
  const me = req.session.userId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = 50;

  try {
    // 1) Load the conversation, populating each message.sender
    const convo = await Conversation.findOne({
      participants: { $all: [me, otherUserId] },
    })
      .populate({
        path: "messages.sender",
        select: "username profile_picture", // only bring back these fields
      })
      .lean(); // gives us plain JS objects

    if (!convo) {
      return res.json({ messages: [] });
    }

    // 2) Sort messages newest-first and slice out the requested page
    const sorted = convo.messages
      .slice() // copy so we don’t mutate the original
      .sort((a, b) => b.timestamp - a.timestamp);

    const pageOfMsgs = sorted.slice((page - 1) * limit, page * limit);

    // 3) Optionally—reverse back to oldest-first for your UI
    const formatted = pageOfMsgs.reverse().map((m) => ({
      sender: m.sender, // { _id, username, profile_picture }
      content: m.content,
      imageUrls: m.imageUrls,
      timestamp: m.timestamp,
    }));

    res.json({ messages: formatted });
  } catch (err) {
    console.error("Fetch chat history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ————————————————
// Socket.IO JWT handshake
// ————————————————
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("unauthorized"));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.id;
    next();
  } catch {
    next(new Error("invalid_token"));
  }
});

// ————————————————
// Socket.IO event handlers
// ————————————————

io.on("connection", (socket) => {
  const me = socket.userId;
  console.log(`✅ Socket connected: user ${me}`);

  // join your private room
  socket.join(me);

  // also join all existing conversation rooms
  Conversation.find({ participants: me })
    .then((convos) => {
      convos.forEach((c) => socket.join(c._id.toString()));
    })
    .catch(console.error);

  // handle sending a DM
  socket.on("sendDM", async ({ toUserId, content, imageUrls }) => {
    try {
      // 1) Persist the raw message to MongoDB
      const msgDoc = {
        sender: me,
        content,
        imageUrls,
        timestamp: new Date(),
      };

      console.log(msgDoc);

      await Conversation.findOneAndUpdate(
        { participants: { $all: [me, toUserId] } },
        { $push: { messages: msgDoc } },
        { upsert: true }
      );

      // 2) Load the sender’s profile so we can broadcast username & avatar
      const senderProfile = await User.findById(me).select(
        "username profile_picture"
      );

      // 3) Build the enriched message object
      const broadcastMsg = {
        sender: {
          _id: me,
          username: senderProfile.username,
          profile_picture: senderProfile.profile_picture,
        },
        content,
        imageUrls,
        timestamp: msgDoc.timestamp,
      };

      // 4) Emit to both participants
      io.to(toUserId).emit("receiveDM", broadcastMsg);
      io.to(me).emit("receiveDM", broadcastMsg);
    } catch (err) {
      console.error("Error in sendDM handler:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: user ${me}`);
  });
});

// ————————————————
// Start server
// ————————————————
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
