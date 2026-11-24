const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: {
    type: String,
    enum: ["customer", "agent", "company_admin", "admin"],
    default: "customer",
  },
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    default: null,
  },
  requestedCompanyName: {
    type: String,
    trim: true,
    default: "",
  },
});

module.exports = mongoose.model("User", UserSchema);
