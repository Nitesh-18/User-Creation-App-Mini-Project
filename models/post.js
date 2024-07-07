const mongoose = require("mongoose");

const postSchema = mongoose.Schema({
  userId: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  ],
  date: {
    type: Date,
    default: Date.now,
  },
  title: String,
  content: String,
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  }],
});

module.exports = mongoose.model("post", postSchema);
