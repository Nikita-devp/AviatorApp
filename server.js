const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

// ✅ CORS
app.use(cors({
  origin: [
    "https://www.lumoup.online"
  ],
  credentials: true
}));

app.use(express.json());

/* =========================
   📦 МОДЕЛИ (ВАЖНО ВВЕРХУ)
========================= */

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  balance: { type: Number, default: 1000 },
  bet: { type: Number, default: 0 },
  nextBet: { type: Number, default: 0 },
  cashedOut: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);

/* =========================
   🔌 SERVER + SOCKET
========================= */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "https://www.lumoup.online"
    ],
    credentials: true
  }
});

/* =========================
   👤 AUTH
========================= */

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    username,
    password: hashedPassword
  });

  await user.save();

  res.json({ success: true });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) {
    return res.json({ error: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    balance: user.balance
  });
});

/* =========================
   📁 STATIC (FRONT)
========================= */

app.use(express.static(path.join(__dirname, "client/dist")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "client/dist/index.html"));
});

/* =========================
   🎮 GAME LOGIC
========================= */

const HISTORY_FILE = "history.json";

let history = [];
if (fs.existsSync(HISTORY_FILE)) {
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE));
  } catch {
    history = [];
  }
}

function saveHistory() {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));
}

let players = {};

function generateCrash() {
  const r = Math.random();
  if (r < 0.25) return 1.0;

  let crash = 0.97 / (1 - r);
  crash = Math.floor(crash * 100) / 100;

  if (crash > 10 && Math.random() < 0.85) crash = 1 + Math.random() * 4;
  if (crash > 20 && Math.random() < 0.9) crash = 1 + Math.random() * 5;
  if (crash > 30) crash = 30;

  return crash;
}

let multiplier = 1;
let gameState = "WAITING";
let crashPoint = generateCrash();
let gameInterval = null;

async function startRound() {
  gameState = "WAITING";
  multiplier = 1;
  crashPoint = generateCrash();

  const users = await User.find();

  for (let user of users) {
    if (user.nextBet > 0 && user.balance >= user.nextBet) {
      user.balance -= user.nextBet;
      user.bet = user.nextBet;
      user.nextBet = 0;
      user.cashedOut = false;

      await user.save();

      for (let socketId in players) {
  if (players[socketId]._id.toString() === user._id.toString()) {
    sendState(io.to(socketId), user);
  }
}
    }
  }

  setTimeout(() => {
  gameState = "RUNNING";

  // отправили state
  for (let socketId in players) {
    const user = players[socketId];
    io.to(socketId).emit("state", {
      gameState,
      bet: user.bet,
      nextBet: user.nextBet,
      cashedOut: user.cashedOut,
      balance: user.balance
    });
  }

  // старт игры
  gameInterval = setInterval(() => {
    multiplier += 0.02;
    io.emit("tick", multiplier);

    if (multiplier >= crashPoint) {
      clearInterval(gameInterval);
      gameInterval = null;
      endRound();
    }

  }, 100);

}, 5000); // ✅ ВОТ ТВОИ 5 СЕКУНД
}

function endRound() {
  history.unshift(multiplier.toFixed(2));
  history = history.slice(0, 25);
  saveHistory();

  io.emit("history", history);
  gameState = "CRASHED";

  for (let socketId in players) {
    const user = players[socketId]; // ✅ ВОТ ТАК
    io.to(socketId).emit("state", {
      gameState,
      bet: user.bet,
      nextBet: user.nextBet,
      cashedOut: user.cashedOut,
      balance: user.balance
    });
  }

  io.emit("crash", multiplier);

  setTimeout(() => {
    startRound();
  }, 3000);
}

/* =========================
   🔌 SOCKET CONNECTION
========================= */

io.on("connection", async (socket) => {

function sendState(socket, user) {
  socket.emit("state", {
    gameState,
    bet: user.bet,
    nextBet: user.nextBet,
    cashedOut: user.cashedOut,
    balance: user.balance
  });
}


  const token = socket.handshake.auth.token;
  if (!token) return;

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return;
  }

  const user = await User.findById(decoded.userId);
  if (!user) return;

  players[socket.id] = user;

  socket.emit("balance", user.balance);

  socket.on("bet", async (amount) => {
    if (amount > user.balance) return;
    if (gameState !== "WAITING") return;

    user.nextBet = amount;
    user.cashedOut = false;

    await user.save();
	sendState(socket, user);
  });

  socket.on("getHistory", () => {
    socket.emit("history", history);
  });

  socket.on("cancelBet", async () => {
    user.nextBet = 0;
    await user.save();
	sendState(socket, user);
  });

  socket.on("cashout", async () => {
    if (!user.bet || user.cashedOut) return;
    if (gameInterval === null) return;

    const win = user.bet * multiplier;

    user.balance += win;
    user.cashedOut = true;
    await user.save();
	sendState(socket, user);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

/* =========================
   🚀 START SERVER
========================= */

console.log("START CONNECT");

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 3001;

    server.listen(PORT, () => {
      console.log("🚀 SERVER RUNNING ON", PORT);
      startRound();
    });
  })
  .catch(err => console.error("❌ Mongo error:", err));