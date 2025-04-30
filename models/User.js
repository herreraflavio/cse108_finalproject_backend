// const mongoose = require("mongoose");

// const UserSchema = new mongoose.Schema({
//   username: { type: String, required: true, unique: true },
//   role: { type: String },
//   password: { type: String, required: true },
// });

// module.exports = mongoose.model("User", UserSchema, "users");

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  role: { type: String },
  password: { type: String, required: true },
  profile_picture: { type: String, default: "" }, // Optional but recommended
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

module.exports = mongoose.model("User", UserSchema, "users");
