const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const cors = require("cors"); // <<< Add this
const User = require("./models/User");
const path = require("path");
require("dotenv").config(); // <<< Load env variables

// … same requires, dotenv, etc.

const app = express();
app.set("trust proxy", 1);

// 1) CORS & preflight
const allowed = [
  "http://localhost:3000",
  "https://cse108-finalproject-frontend.vercel.app",
];
app.use(cors({ origin: allowed, credentials: true }));

// 2) static, body, cookies
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(express.json());
app.use(cookieParser());

// 3) DB + sessions
// Connect to MongoDB Atlas
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // ← lax works over HTTP in dev
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// Models
const UserSchema = require("./models/User");

// Middleware
const ensureAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

// Routes
const testRoutes = require("./routes/test");
const Register = require("./routes/auth/Register");
const Login = require("./routes/auth/Login");
const Logout = require("./routes/auth/Logout");
const Post = require("./routes/posts/Post");
const Follow = require("./routes/user/Follow");
const Feed = require("./routes/user/Feed");

app.use("/test", ensureAuth, testRoutes);
app.use("/auth/register", Register);
app.use("/auth/login", Login);
app.use("/auth/logout", Logout);
app.use("/posts/post", Post);
app.use("/user/follow", Follow);
app.use("/user/feed", Feed);

app.get("/api/profile", async (req, res) => {
  if (!req.session.userId) return res.status(401).send("Not authenticated.");

  const user = await User.findById(req.session.userId).select("-password");
  res.json(user);
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.send("Logged out.");
  });
});

app.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Not authenticated.");
  }

  try {
    const user = await User.findById(req.session.userId).select(
      "id username role"
    );
    if (!user) {
      return res.status(404).send("User not found.");
    }

    res.json({
      id: user._id,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error.");
  }
});

// SEARCH USERS

app.get("/api/search-users", ensureAuth, async (req, res) => {
  try {
    // 1) grab the query string
    const q = (req.query.q || "").trim();
    console.log("search term:", q);

    // 2) build your case‐insensitive regex
    const regex = new RegExp(q, "i");

    // 3) find users whose username matches
    const users = await UserSchema.find({ username: regex }).select(
      "username profilePicture"
    ); // include whatever fields you need

    console.log("search result:", users);

    // 4) send them back
    return res.json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// FOLLOW RECOMMENDATIONS
// GET /api/follow-recommendations
app.get("/api/follow-recommendations", ensureAuth, async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.session.userId);

    const recommendations = await UserSchema.aggregate([
      { $match: { _id: { $ne: currentUserId } } },
      { $sample: { size: 5 } },
      { $project: { password: 0 } },
    ]);

    res.json({ users: recommendations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 9000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
