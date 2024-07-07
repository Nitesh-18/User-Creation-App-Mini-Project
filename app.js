require("events").EventEmitter.prototype._maxListeners = 100;

const express = require("express");
const app = express();
const path = require("path");
const bcryptjs = require("bcryptjs");

const userModel = require("./models/user");
const postModel = require("./models/post");

const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const session = require("express-session");
const mongoose = require('mongoose');  // Ensure mongoose is imported

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("combined"));

// Session middleware
app.use(session({
  secret: 'shhh', // replace with a secure secret
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // use true if using https
}));

// Flash message middleware
app.use((req, res, next) => {
  res.locals.message = req.session.message;
  delete req.session.message;
  next();
});

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
    likes: []
  });
  user.posts.push(post._id);
  await user.save({ validateBeforeSave: false });
  res.redirect("/profile");
});

// Like/Unlike Post Route
app.post("/like", isLoggedIn, async (req, res) => {
  const postId = req.body.postId;
  // try {
  //   const post = await postModel.findById(postId);
  //   if (!post) return res.status(404).send("Post not found");

  //   const userId = mongoose.Types.ObjectId(req.user.userId);
  //   const likeIndex = post.likes.indexOf(userId);

  //   if (likeIndex === -1) {
  //     // User hasn't liked the post yet
  //     post.likes.push(userId);
  //   } else {
  //     // User already liked the post, so we remove the like (unlike)
  //     post.likes.splice(likeIndex, 1);
  //   }

  //   await post.save();
  //   res.send(`Likes: ${post.likes.length}`);
  // } catch (error) {
  //   console.error("Error liking post:", error);
  //   res.status(500).send("An error occurred while liking the post");
  // }
});

// Delete Post Route
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

    // Set flash message
    req.session.message = { type: 'success', text: 'Successfully deleted post' };
    res.redirect("/profile");
  } catch (error) {
    console.error("Error deleting post:", error); // Log the error for debugging
    req.session.message = { type: 'error', text: 'Error deleting post' };
    res.status(500).redirect("/profile");
  }
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
  console.log("Server is running on port 3000");
});

module.exports = app;
