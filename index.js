const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const sharedSession = require("express-socket.io-session");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Models
const User = require("./models/User");

// Express setup
const app = express();
app.set("trust proxy", 1); // for cookies on services like Render

// HTTP + WebSocket server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://cse108-finalproject-frontend.vercel.app",
    ],
    credentials: true,
  },
});

// CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://cse108-finalproject-frontend.vercel.app",
    ],
    credentials: true,
  })
);

// Middleware
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(express.json());
app.use(cookieParser());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Session middleware
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
io.use(sharedSession(sessionMiddleware, { autoSave: true }));

// Protect routes
const ensureAuth = (req, res, next) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not authenticated" });
  next();
};

// Routes
const testRoutes = require("./routes/test");
const Register = require("./routes/auth/Register");
const Login = require("./routes/auth/Login");
const Logout = require("./routes/auth/Logout");
const Profile = require("./routes/auth/Profile");
const Post = require("./routes/posts/Post");
const Follow = require("./routes/user/Follow");
const Unfollow = require("./routes/user/Unfollow");
const Feed = require("./routes/user/Feed");
const Recommendations = require("./routes/search/Recomendations");
const UserProfile = require("./routes/search/UserProfile");

app.use("/test", ensureAuth, testRoutes);
app.use("/auth/register", Register);
app.use("/auth/login", Login);
app.use("/auth/logout", ensureAuth, Logout);
app.use("/auth/profile", ensureAuth, Profile);
app.use("/posts/post", ensureAuth, Post);
app.use("/user/follow", ensureAuth, Follow);
app.use("/user/unfollow", ensureAuth, Unfollow);
app.use("/user/feed", ensureAuth, Feed);
app.use("/search/recommendations", ensureAuth, Recommendations);
app.use("/search/userprofile", ensureAuth, UserProfile);
app.use("/search/self", ensureAuth, UserProfile);

// Simple user info route
app.get("/me", async (req, res) => {
  if (!req.session.userId) return res.status(401).send("Not authenticated.");

  try {
    const user = await User.findById(req.session.userId).select(
      "id username role"
    );
    if (!user) return res.status(404).send("User not found.");
    res.json({ _id: user._id, username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error.");
  }
});

// === NEW: JWT middleware for sockets ===
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("unauthorized"));
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.id; // attach to socket
    next();
  } catch (err) {
    next(new Error("invalid_token"));
  }
});

// Socket.IO logic (uses socket.userId instead of session)
io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log(`✅ User ${userId} connected via Socket.IO`);

  socket.join(userId);

  socket.emit("hello", {
    message: `Hello, user ${userId}!`,
    timestamp: new Date().toISOString(),
  });

  socket.on("sendDM", ({ toUserId, message }) => {
    const payload = {
      from: userId,
      message,
      timestamp: new Date().toISOString(),
    };
    io.to(toUserId).emit("receiveDM", payload);
  });

  socket.on("disconnect", () => {
    console.log(`User ${userId} disconnected`);
  });
});

// Start server
const PORT = process.env.PORT || 9000;
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
