const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const cors = require("cors"); // <<< Add this
const User = require("./models/User");
require("dotenv").config(); // <<< Load env variables

const app = express();
app.set("trust proxy", 1);

app.use("/assets", express.static(path.join(__dirname, "assets")));

// Allow CORS for localhost:3000
app.use(
  cors({
    origin: "http://localhost:3000", // Only allow this origin
    credentials: true, // Allow cookies to be sent
  })
);

app.use(express.json());
app.use(cookieParser());

// Connect to MongoDB Atlas
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Configure sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),
    cookie: {
      secure: true, // <-- important: because Render is HTTPS
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: "none", // <-- important: allow cross-origin cookie sending
    },
  })
);

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

  const user = await User.findOne({ username });
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

const PORT = process.env.PORT || 9000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
