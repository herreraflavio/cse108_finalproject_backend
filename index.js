// server.js
require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// Models
const User = require("./models/User");
const Conversation = require("./models/Conversation");
const UploadCounter = require("./models/UploadCounter");

const app = express();
app.set("trust proxy", 1);

// ─── 0) HEALTH-CHECK ENDPOINT ─────────────────────────────────────────────
// Respond 200 to GET / and HEAD / so Render’s healthcheck passes
app.get("/", (req, res) => res.sendStatus(200));
app.head("/", (req, res) => res.sendStatus(200));

// ─── 1) LOG *every* incoming request ─────────────────────────────────────
app.use((req, res, next) => {
  console.log("\n===== INCOMING REQUEST =====");
  console.log(`${req.method} ${req.originalUrl}`);
  console.log("Headers:", req.headers);
  next();
});

// ─── 2) CORS SETUP ─────────────────────────────────────────────────────────
const corsOptions = {
  origin: (origin, callback) => {
    console.log(`[CORS] incoming Origin: ${origin}`);
    if (!origin) {
      // no Origin header (e.g. healthcheck, curl) → skip CORS
      return callback(null, false);
    }
    // browser request → allow
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
app.use(cors(corsOptions));

// ─── 3) GENERAL MIDDLEWARE ────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// ─── 4) MONGOOSE CONNECTION ───────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB Atlas");
    return UploadCounter.findOne({ name: "global" }).then((exists) => {
      if (!exists) {
        console.log("📦 Initializing upload counter");
        return UploadCounter.create({ name: "global", count: 0 });
      }
      console.log("ℹ️ Upload counter exists");
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ─── 5) SESSION SETUP ────────────────────────────────────────────────────
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
app.use((req, res, next) => sessionMiddleware(req, res, next));

// ─── 7) AUTH MIDDLEWARE ──────────────────────────────────────────────────
const ensureAuth = (req, res, next) => {
  console.log(`[AUTH CHECK] session.userId=${req.session?.userId}`);
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

// ─── 8) ROUTES ────────────────────────────────────────────────────────────
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
app.use("/uploads/images", require("./routes/uploads/Images"));

app.get("/me", ensureAuth, async (req, res) => {
  console.log("[ROUTE /me] fetching current user");
  try {
    const user = await User.findById(req.session.userId).select(
      "_id username role"
    );
    if (!user) return res.status(404).send("User not found.");
    res.json(user);
  } catch (err) {
    console.error("❌ /me error:", err);
    res.status(500).send("Server error.");
  }
});

app.get("/api/chats/:userId", ensureAuth, async (req, res) => {
  console.log(`[ROUTE /api/chats/${req.params.userId}] page=${req.query.page}`);
  const otherUserId = req.params.userId;
  const me = req.session.userId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = 50;

  try {
    const convo = await Conversation.findOne({
      participants: { $all: [me, otherUserId] },
    })
      .populate({ path: "messages.sender", select: "username profile_picture" })
      .lean();

    if (!convo) {
      console.log("→ No convo found, returning empty");
      return res.json({ messages: [] });
    }

    const sorted = convo.messages
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp);
    const pageOfMsgs = sorted.slice((page - 1) * limit, page * limit);
    const formatted = pageOfMsgs.reverse().map((m) => ({
      sender: m.sender,
      content: m.content,
      imageUrls: m.imageUrls,
      timestamp: m.timestamp,
    }));

    res.json({ messages: formatted });
  } catch (err) {
    console.error("❌ Fetch chat history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── 9) SOCKET.IO SETUP ──────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      console.log("[Socket.IO CORS] origin:", origin);
      callback(null, true);
    },
    credentials: true,
  },
});

// Log handshake details
io.use((socket, next) => {
  console.log("=== Socket.IO HANDSHAKE ===");
  console.log("Headers:", socket.handshake.headers);
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.log("🚫 No token in handshake");
    return next(new Error("unauthorized"));
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.id;
    console.log("✅ Handshake token valid, userId =", socket.userId);
    next();
  } catch (err) {
    console.log("🚫 Invalid token:", err.message);
    next(new Error("invalid_token"));
  }
});

io.on("connection", (socket) => {
  const me = socket.userId;
  console.log(`✅ Socket connected: user ${me}`);
  socket.join(me);

  // join all existing convos
  Conversation.find({ participants: me })
    .then((convos) => convos.forEach((c) => socket.join(c._id.toString())))
    .catch((e) => console.error("❌ join convos error:", e));

  socket.on("sendDM", async ({ toUserId, content, imageUrls }) => {
    console.log(`[sendDM] from ${me} → ${toUserId}:`, content, imageUrls);
    try {
      const msgDoc = { sender: me, content, imageUrls, timestamp: new Date() };
      await Conversation.findOneAndUpdate(
        { participants: { $all: [me, toUserId] } },
        { $push: { messages: msgDoc } },
        { upsert: true }
      );
      const senderProfile = await User.findById(me).select(
        "username profile_picture"
      );
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
      io.to(toUserId).emit("receiveDM", broadcastMsg);
      io.to(me).emit("receiveDM", broadcastMsg);
      console.log("[sendDM] broadcast complete");
    } catch (err) {
      console.error("❌ Error in sendDM handler:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: user ${me}`);
  });
});

// ─── 10) START SERVER ────────────────────────────────────────────────────
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// require("dotenv").config();
// const path = require("path");
// const http = require("http");
// const express = require("express");
// const mongoose = require("mongoose");
// const session = require("express-session");
// const MongoStore = require("connect-mongo");
// const cookieParser = require("cookie-parser");
// const cors = require("cors");
// const { Server } = require("socket.io");
// const jwt = require("jsonwebtoken");

// // Models
// const User = require("./models/User");
// const Conversation = require("./models/Conversation");

// const app = express();
// app.set("trust proxy", 1);

// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: [
//       "http://localhost:3000",
//       "https://cse108.flavioherrera.com",
//       "https://cse108-finalproject-frontend.vercel.app",
//     ],
//     credentials: true,
//   },
// });

// app.use(
//   cors({
//     origin: [
//       "http://localhost:3000",
//       "https://cse108.flavioherrera.com",
//       "https://cse108-finalproject-frontend.vercel.app",
//     ],
//     credentials: true,
//   })
// );
// app.use("/assets", express.static(path.join(__dirname, "assets")));
// app.use(express.json());
// app.use(cookieParser());

// mongoose
//   .connect(process.env.MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => {
//     console.log("✅ Connected to MongoDB Atlas");
//     initCounter();
//   })
//   .catch((err) => console.error("❌ MongoDB connection error:", err));

// const sessionMiddleware = session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
//   cookie: {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
//     maxAge: 1000 * 60 * 60 * 24,
//   },
// });
// app.use(sessionMiddleware);

// const ensureAuth = (req, res, next) => {
//   if (!req.session.userId) {
//     return res.status(401).json({ error: "Not authenticated" });
//   }
//   next();
// };

// const UploadCounter = require("./models/UploadCounter");

// async function initCounter() {
//   const exists = await UploadCounter.findOne({ name: "global" });
//   if (!exists) {
//     await UploadCounter.create({ name: "global", count: 0 });
//     console.log("📦 Upload counter initialized");
//   } else {
//     console.log("ℹ️ Upload counter already exists");
//   }
// }

// app.use("/test", ensureAuth, require("./routes/test"));
// app.use("/auth/register", require("./routes/auth/Register"));
// app.use("/auth/login", require("./routes/auth/Login"));
// app.use("/auth/logout", ensureAuth, require("./routes/auth/Logout"));
// app.use("/auth/profile", ensureAuth, require("./routes/auth/Profile"));
// app.use("/posts/post", ensureAuth, require("./routes/posts/Post"));
// app.use("/user/follow", ensureAuth, require("./routes/user/Follow"));
// app.use("/user/unfollow", ensureAuth, require("./routes/user/Unfollow"));
// app.use("/user/feed", ensureAuth, require("./routes/user/Feed"));
// app.use(
//   "/search/recommendations",
//   ensureAuth,
//   require("./routes/search/Recomendations")
// );
// app.use(
//   "/search/userprofile",
//   ensureAuth,
//   require("./routes/search/UserProfile")
// );
// app.use("/search/self", ensureAuth, require("./routes/search/UserProfile"));
// app.use("/uploads/images", require("./routes/uploads/Images"));

// app.get("/me", ensureAuth, async (req, res) => {
//   try {
//     const user = await User.findById(req.session.userId).select(
//       "_id username role"
//     );
//     if (!user) return res.status(404).send("User not found.");
//     res.json(user);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server error.");
//   }
// });

// app.get("/api/chats/:userId", ensureAuth, async (req, res) => {
//   const otherUserId = req.params.userId;
//   const me = req.session.userId;
//   const page = parseInt(req.query.page, 10) || 1;
//   const limit = 50;

//   try {
//     const convo = await Conversation.findOne({
//       participants: { $all: [me, otherUserId] },
//     })
//       .populate({
//         path: "messages.sender",
//         select: "username profile_picture",
//       })
//       .lean();

//     if (!convo) {
//       return res.json({ messages: [] });
//     }

//     const sorted = convo.messages
//       .slice()
//       .sort((a, b) => b.timestamp - a.timestamp);

//     const pageOfMsgs = sorted.slice((page - 1) * limit, page * limit);

//     const formatted = pageOfMsgs.reverse().map((m) => ({
//       sender: m.sender,
//       content: m.content,
//       imageUrls: m.imageUrls,
//       timestamp: m.timestamp,
//     }));

//     res.json({ messages: formatted });
//   } catch (err) {
//     console.error("Fetch chat history error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// io.use((socket, next) => {
//   const token = socket.handshake.auth?.token;
//   if (!token) return next(new Error("unauthorized"));
//   try {
//     const payload = jwt.verify(token, process.env.JWT_SECRET);
//     socket.userId = payload.id;
//     next();
//   } catch {
//     next(new Error("invalid_token"));
//   }
// });

// io.on("connection", (socket) => {
//   const me = socket.userId;
//   console.log(`✅ Socket connected: user ${me}`);

//   socket.join(me);

//   Conversation.find({ participants: me })
//     .then((convos) => {
//       convos.forEach((c) => socket.join(c._id.toString()));
//     })
//     .catch(console.error);

//   socket.on("sendDM", async ({ toUserId, content, imageUrls }) => {
//     try {
//       const msgDoc = {
//         sender: me,
//         content,
//         imageUrls,
//         timestamp: new Date(),
//       };

//       console.log(msgDoc);

//       await Conversation.findOneAndUpdate(
//         { participants: { $all: [me, toUserId] } },
//         { $push: { messages: msgDoc } },
//         { upsert: true }
//       );

//       const senderProfile = await User.findById(me).select(
//         "username profile_picture"
//       );

//       const broadcastMsg = {
//         sender: {
//           _id: me,
//           username: senderProfile.username,
//           profile_picture: senderProfile.profile_picture,
//         },
//         content,
//         imageUrls,
//         timestamp: msgDoc.timestamp,
//       };

//       io.to(toUserId).emit("receiveDM", broadcastMsg);
//       io.to(me).emit("receiveDM", broadcastMsg);
//     } catch (err) {
//       console.error("Error in sendDM handler:", err);
//     }
//   });

//   socket.on("disconnect", () => {
//     console.log(`❌ Socket disconnected: user ${me}`);
//   });
// });

// const PORT = process.env.PORT || 9000;
// server.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });

// // testing 2
