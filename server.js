const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(cors({ origin: ["https://lumoup.online", "https://www.lumoup.online"], credentials: true }));
app.use(express.json());

// Модель пользователя с исправленными полями
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  balance: { type: Number, default: 1000 },
  bet: { type: Number, default: 0 },
  nextBet: { type: Number, default: 0 },
  cashedOut: { type: Boolean, default: false }
});
const User = mongoose.model("User", userSchema);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let history = [];
let players = {};
let multiplier = 1;
let gameState = "WAITING"; // Добавлено состояние игры
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

  // Активация ставок на раунд
  const users = await User.find({ nextBet: { $gt: 0 } });
  for (let user of users) {
    user.bet = user.nextBet;
    user.nextBet = 0;
    user.cashedOut = false;
    await user.save();
    
    // Оповещаем сокеты пользователя
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
    const freshUser = await User.findById(user._id);
    if (amount > freshUser.balance || gameState !== "WAITING") return;
    freshUser.balance -= amount;
    freshUser.nextBet = amount;
    await freshUser.save();
    socket.emit("balance", freshUser.balance);
  });

  socket.on("cashout", async () => {
    const freshUser = await User.findById(user._id);
    if (!freshUser.bet || freshUser.cashedOut || gameState !== "RUNNING") return;
    const win = freshUser.bet * multiplier;
    freshUser.balance += win;
    freshUser.cashedOut = true;
    freshUser.bet = 0;
    await freshUser.save();
    socket.emit("balance", freshUser.balance);
  });

  socket.on("disconnect", () => delete players[socket.id]);
});

mongoose.connect(process.env.MONGO_URI).then(() => {
  server.listen(3001, () => startRound());
});