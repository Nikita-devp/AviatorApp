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

// 1. Сначала объявляем схемы, чтобы не было ошибок "User is not defined"
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  balance: { type: Number, default: 1000 },
  bet: { type: Number, default: 0 },
  nextBet: { type: Number, default: 0 },
  cashedOut: { type: Boolean, default: false }
});
const User = mongoose.model("User", userSchema);

// 2. Инициализируем переменные игры
let history = [];
let players = {};
let multiplier = 1.0;
let gameState = "WAITING"; // Критично: переменная должна быть объявлена сразу
let crashPoint = 1.0;
let gameInterval = null;

// ПУТИ: Render видит твою папку 'client', используем это
const distPath = path.join(__dirname, "client", "dist");
app.use(express.static(distPath));

// API Роуты
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password, balance: 1000 });
    await user.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "User already exists or DB error" }); }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.json({ error: "Invalid credentials" });
  res.json({ userId: user._id, balance: user.balance });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

function generateCrash() {
  const r = Math.random();
  if (r < 0.25) return 1.0;
  let crash = 0.97 / (1 - r);
  return Math.min(Math.floor(crash * 100) / 100, 35);
}

async function startRound() {
  gameState = "WAITING";
  multiplier = 1.0;
  crashPoint = generateCrash();

  const users = await User.find({ nextBet: { $gt: 0 } });
  for (let u of users) {
    u.balance -= u.nextBet;
    u.bet = u.nextBet;
    u.nextBet = 0;
    u.cashedOut = false;
    await u.save();
    
    for (let sid in players) {
      if (players[sid]._id.toString() === u._id.toString()) {
        io.to(sid).emit("balance", u.balance);
      }
    }
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
  try {
    const user = await User.findById(userId);
    if (!user) return;
    players[socket.id] = user;
    socket.emit("balance", user.balance);
    socket.emit("history", history);
  } catch (err) { console.log("Socket connect error"); }

  socket.on("bet", async (amount) => {
    const u = await User.findById(players[socket.id]?._id);
    if (u && amount <= u.balance && gameState === "WAITING") {
      u.nextBet = amount;
      await u.save();
    }
  });

  socket.on("cashout", async () => {
    const u = await User.findById(players[socket.id]?._id);
    if (u && u.bet > 0 && !u.cashedOut && gameState === "RUNNING") {
      u.balance += (u.bet * multiplier);
      u.cashedOut = true;
      u.bet = 0;
      await u.save();
      socket.emit("balance", u.balance);
    }
  });

  socket.on("disconnect", () => delete players[socket.id]);
});

// ОБЯЗАТЕЛЬНО: Прокси для React Router
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

mongoose.connect(process.env.MONGO_URI).then(() => {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on port", PORT);
    startRound();
  });
});