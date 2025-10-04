const mongoose = require("mongoose");

const addAddressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  pincode: { type: String, required: true, match: /^[1-9][0-9]{5}$/ },
  country: String,
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    select: false,
  },
  fullName: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
  },
  role: {
    type: String,
    enum: ["user", "seller"],
    default: "user",
  },
  addresses: [addAddressSchema],
});

const userModel = mongoose.model("user", userSchema);

module.exports = userModel;
