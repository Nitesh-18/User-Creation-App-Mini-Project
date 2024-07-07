require("events").EventEmitter.prototype._maxListeners = 100;

const express = require("express");
const app = express();
const path = require("path");
const bcryptjs = require("bcryptjs");

const mongoose= require('mongoose');
const userModel = require("./models/user");
const postModel = require("./models/post");

const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("combined"));

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel
    .findOne({ email: req.user.email })
    .populate("posts");
  res.render("profile", { user });
});

app.post("/post", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { title, content } = req.body;
  let post = await postModel.create({
    userId: user._id,
    title,
    content,
  });
  user.posts.push(post._id);
  await user.save({ validateBeforeSave: false });
  res.redirect("/profile");
});

app.get("/like/:postId", isLoggedIn, async (req, res) => {
  const postId = req.params.postId;
  const post = await postModel.findById(postId);
  if (!post) return res.status(404).send("Post not found");
  post.likes = (post.likes || 0) + 1;
  await post.save();
  res.redirect("/profile");
});

app.get("/delete/:postId", isLoggedIn, async (req, res) => {
  try {
    const postId = req.params.postId;
    const user = await userModel.findOne({ email: req.user.email });
    const post = await postModel.findById(postId);
    if (!post) return res.status(404).send("Post not found");

    const postUserId = post.userId.toString();
    const userId = user._id.toString();

    if (postUserId !== userId) {
      return res.status(403).send("Unauthorized action");
    }

    // Remove the post from the user's posts array
    user.posts.pull(postId);
    await user.save({ validateBeforeSave: false });

    // Remove the post from the database
    await post.deleteOne();

    res.redirect("/profile");
  } catch (error) {
    console.error("Error deleting post:", error); // Log the error for debugging
    res.status(500).send("An error occurred while deleting the post");
  }
});

app.get("/edit/:postId", isLoggedIn, async (req, res) => {
  const postId = req.params.postId;
  const post = await postModel.findById(postId);
  if (!post) return res.status(404).send("Post not found");
  if (!post.userId.equals(req.user.userId))
    return res.status(403).send("Unauthorized action");

  res.render("edit", { post });
});

app.post("/edit/:postId", isLoggedIn, async (req, res) => {
  const postId = req.params.postId;
  const { title, content } = req.body;
  const post = await postModel.findById(postId);
  if (!post) return res.status(404).send("Post not found");
  if (!post.userId.equals(req.user.userId))
    return res.status(403).send("Unauthorized action");

  post.title = title;
  post.content = content;
  await post.save();
  res.redirect("/profile");
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

app.post("/register", async (req, res) => {
  let { username, name, age, password, email } = req.body;
  let userEmail = await userModel.findOne({ email });
  if (userEmail) return res.status(409).send("User already registered!");

  const salt = await bcryptjs.genSalt(10);
  const hashedPassword = await bcryptjs.hash(password, salt);

  let user = await userModel.create({
    username,
    name,
    age,
    password: hashedPassword,
    email,
  });

  let token = jwt.sign({ email: email, userId: user._id }, "shhh");
  res.cookie("token", token);
  res.send("User Registered!");
});

app.post("/login", async (req, res) => {
  let { email, password } = req.body;
  let user = await userModel.findOne({ email });
  if (!user) return res.status(401).send("Invalid Credentials!");

  const isMatch = await bcryptjs.compare(password, user.password);
  if (isMatch) {
    let token = jwt.sign({ email: email, userId: user._id }, "shhh");
    res.cookie("token", token);
    res.redirect("/profile");
  } else {
    res.status(401).send("Invalid Credentials!");
  }
});

function isLoggedIn(req, res, next) {
  if (!req.cookies.token) {
    res.redirect("/login");
  } else {
    try {
      let data = jwt.verify(req.cookies.token, "shhh");
      req.user = data;
      next();
    } catch (err) {
      res.redirect("/login");
    }
  }
}

app.use((req, res, next) => {
  res.status(404).send("Sorry, page not found");
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});

module.exports = app;
