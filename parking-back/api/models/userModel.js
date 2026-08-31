const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const USER_ROLES = ["user", "staff", "admin"];
const USER_STATUSES = ["online", "offline", "disable"];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "username is required"],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "password is required"],
      select: false,
    },
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
    },
    role: {
      type: String,
      required: [true, "role is required"],
      enum: USER_ROLES,
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "offline",
    },
    date_add: {
      type: String,
      required: true,
      immutable: true,
    },
    time_add: {
      type: String,
      required: true,
      immutable: true,
    },
    user_image: {
      type: String,
      default: null,
    },
  },
  {
    collection: "user",
    versionKey: false,
  },
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
module.exports.USER_ROLES = USER_ROLES;
module.exports.USER_STATUSES = USER_STATUSES;
