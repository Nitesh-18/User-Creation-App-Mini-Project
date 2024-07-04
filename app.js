require("events").EventEmitter.prototype._maxListeners = 100;

const express = require("express");
const app = express();
const path = require('path');

const userModel = require("./models/user");
const postModel = require("./models/post");

const cookieParser = require("cookie-parser");
const { render } = require("ejs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const user = require("./models/user");

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email }).populate("posts");
  let posts = await postModel.find({ userId: user._id }); // fetch posts for the user
  // user.populate("posts");
  res.render("profile", { user, posts : user.posts}); // pass posts to the template
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
  await user.save();
  res.redirect("/profile");
});

app.post("/like", isLoggedIn, async (req, res) => {
  const postId = req.body.postId;
  const post = await postModel.findById(postId);
  if (!post) return res.status(404).send("Post not found");
  await post.save();

  res.send(`Liked! (${post.likes} likes)`);
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

app.post("/register", async (req, res) => {
  let { username, name, age, password, email } = req.body;
  let userEmail = await userModel.findOne({ email });
  if (userEmail) return res.status(409).send("User already registered !");

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      let user = await userModel.create({
        username,
        name,
        age,
        password: hash,
        email,
      });

      let token = jwt.sign({ email: email, userId: user._id }, "shhh");
      res.cookie("token", token);
      res.send("User Registered !");
    });
  });
});

app.post("/login", async (req, res) => {
  let { email, password } = req.body;
  let user = await userModel.findOne({ email });
  if (!user) return res.status(401).send("Invalid Credentials !");
  bcrypt.compare(password, user.password, (err, result) => {
    if (result) {
      let token = jwt.sign({ email: email, userId: user._id }, "shhh");
      res.cookie("token", token);
      res.redirect("/profile");
    } else {
      res.status(401).send("Invalid Credentials !");
    }
  });
});

function isLoggedIn(req, res, next) {
  if (!req.cookies.token) res.redirect("/login");
  else {
    let data = jwt.verify(req.cookies.token, "shhh");
    req.user = data;
    next();
  }
}

app.listen(3000);
