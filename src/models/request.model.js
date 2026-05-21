import mongoose from "mongoose";

const requestSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  city: String,
  plan: String,
  createdAt: Date
});

const Request = mongoose.model("Request", requestSchema);

export {Request}
