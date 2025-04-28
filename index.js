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

// app.use(
//   cors({
//     origin: [
//       "http://localhost:3000",
//       "https://cse108-finalproject-frontend.vercel.app",
//     ], // Only allow this origin
//     credentials: true, // Allow cookies to be sent
//   })
// );

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

// app.use(
//   session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
//     cookie: {
//       secure: process.env.NODE_ENV === "production",
//       httpOnly: true,
//       sameSite: "none",
//       maxAge: 1000 * 60 * 60 * 24,
//     },
//   })
// );

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

const UserSchema = require("./models/User");

// Routes
app.post("/api/register", async (req, res) => {
  const { username, role, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = new User({ username, role, password: hashedPassword });
    await user.save();
    res.send("User registered.");
  } catch (err) {
    res.status(400).send("Error creating user.");
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await UserSchema.findOne({ username });
  if (!user) return res.status(400).send("User not found.");

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(401).send("Invalid credentials.");

  req.session.userId = user._id;
  res.send("Logged in.");
});

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

// auth-protection middleware
const ensureAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

// SEARCH USERS
// GET /api/search-users?q=flavio
// app.get("/api/search-users", ensureAuth, async (req, res) => {

//   console.log("all users:", await UserSchema.find().select("username"));
// });
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
// app.get("/api/follow-recommendations", ensureAuth, async (req, res) => {
//   try {
//     // pick 5 random users that aren't the current user
//     const recommendations = await User.aggregate([
//       { $match: { _id: { $ne: mongoose.Types.ObjectId(req.session.userId) } } },
//       { $sample: { size: 5 } },
//       { $project: { password: 0 } }, // strip out password
//     ]);
//     res.json({ users: recommendations });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

const PORT = process.env.PORT || 9000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
