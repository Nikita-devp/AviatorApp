const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(cors({
  origin: ["https://lumoup.online", "https://www.lumoup.online"],
  credentials: true
}));
app.use(express.json());

// Схема пользователя (добавлено nextBet)
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  balance: { type: Number, default: 1000 },
  bet: { type: Number, default: 0 },
  nextBet: { type: Number, default: 0 },
  cashedOut: { type: Boolean, default: false }
});
const User = mongoose.model("User", userSchema);

// РАЗДАЧА ФРОНТЕНДА (Исправлено для Render)
// Если папка dist лежит в корне проекта:
const distPath = path.join(__dirname, "dist"); 
// Если она внутри папки client:
// const distPath = path.join(__dirname, "client", "dist");

app.use(express.static(distPath));

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = new User({ username, password, balance: 1000 });
    await user.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.json({ error: "Invalid credentials" });
  res.json({ userId: user._id, balance: user.balance });
});

// Все остальные запросы шлем на index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let history = [];
let players = {};
let multiplier = 1;
let gameState = "WAITING"; // БЫЛО ПРОПУЩЕНО
let gameInterval = null;

function generateCrash() {
  const r = Math.random();
  if (r < 0.25) return 1.0;
  let crash = 0.97 / (1 - r);
  return Math.min(Math.floor(crash * 100) / 100, 30);
}

async function startRound() {
  gameState = "WAITING";
  multiplier = 1;
  let crashPoint = generateCrash();

  const users = await User.find({ nextBet: { $gt: 0 } });
  for (let user of users) {
    user.bet = user.nextBet;
    user.nextBet = 0;
    user.cashedOut = false;
    await user.save();
    
    Object.keys(players).forEach(sid => {
      if (players[sid]._id.toString() === user._id.toString()) {
        io.to(sid).emit("balance", user.balance);
      }
    });
  }

  setTimeout(() => {
    gameState = "RUNNING";
    gameInterval = setInterval(() => {
      multiplier += 0.02;
      io.emit("tick", multiplier);
      if (multiplier >= crashPoint) {
        clearInterval(gameInterval);
        endRound();
      }
    }, 100);
  }, 5000);
}

function endRound() {
  history.unshift(multiplier.toFixed(2));
  history = history.slice(0, 25);
  io.emit("history", history);
  io.emit("crash", multiplier);
  setTimeout(startRound, 3000);
}

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;
  if (!userId) return;
  const user = await User.findById(userId);
  if (!user) return;
  players[socket.id] = user;

  socket.emit("balance", user.balance);
  socket.emit("history", history);

  socket.on("bet", async (amount) => {
    const u = await User.findById(user._id);
    if (amount > u.balance || gameState !== "WAITING") return;
    u.balance -= amount;
    u.nextBet = amount;
    await u.save();
    socket.emit("balance", u.balance);
  });

  socket.on("cashout", async () => {
    const u = await User.findById(user._id);
    if (!u.bet || u.cashedOut || gameState !== "RUNNING") return;
    u.balance += (u.bet * multiplier);
    u.cashedOut = true;
    u.bet = 0;
    await u.save();
    socket.emit("balance", u.balance);
  });

  socket.on("disconnect", () => delete players[socket.id]);
});

mongoose.connect(process.env.MONGO_URI).then(() => {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, "0.0.0.0", () => startRound());
});