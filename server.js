const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();
const app = express();
app.use(cors({
  origin: [
    "https://lumoup.online",
    "https://www.lumoup.online"
  ],
  credentials: true
}));
app.use(express.json());

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const bcrypt = require("bcrypt");

const hashedPassword = await bcrypt.hash(password, 10);

const user = new User({
  username,
  password: hashedPassword,
  balance: 1000
});

  await user.save();

  res.json({ success: true });
});


const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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


const path = require("path");

app.use(express.static(path.join(__dirname, "client/dist")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "client/dist/index.html"));
});


const mongoose = require("mongoose");

console.log("START CONNECT");

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 3001;

    server.listen(PORT, () => {
      console.log("SERVER", PORT);
      startRound();
    });
  })
  .catch(err => console.error("❌ Mongo error:", err));
  
  // модель польза
  
  const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  balance: { type: Number, default: 1000 },
  bet: { type: Number, default: 0 },
  nextBet: { type: Number, default: 0 },
  cashedOut: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);
  
  const playerSchema = new mongoose.Schema({
  socketId: String,
  balance: Number,
  bet: Number,
  cashedOut: Boolean
});

const Player = mongoose.model("Player", playerSchema);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://lumoup.online",
      "https://www.lumoup.online"
    ],
    credentials: true
  }
});

// 📂 файл истории
const HISTORY_FILE = "history.json";

// 📊 загрузка истории
let history = [];
if (fs.existsSync(HISTORY_FILE)) {
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE));
  } catch {
    history = [];
  }
}

// 💾 сохранение
function saveHistory() {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));
}

// 👤 игроки
let players = {};

// 🎯 генерация краша
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

// 🚀 игра
let multiplier = 1;
let gameState = "WAITING";
let crashPoint = generateCrash();
let gameInterval = null;

async function startRound() {
  gameState = "WAITING";
  multiplier = 1;
  crashPoint = generateCrash();

  // 👇 ПРИМЕНЯЕМ СТАВКИ
  const users = await User.find();

  for (let user of users) {
    if (user.nextBet > 0 && user.balance >= user.nextBet) {
      user.balance -= user.nextBet;
      user.bet = user.nextBet;
      user.nextBet = 0;
      user.cashedOut = false;

      await user.save();

      // если игрок онлайн — обновим баланс
      for (let socketId in players) {
        if (players[socketId]._id.toString() === user._id.toString()) {
          io.to(socketId).emit("balance", user.balance);
        }
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
      gameInterval = null;
      endRound();
    }
  }, 100);

}, 5000);
}

function endRound() {
  // история
  history.unshift(multiplier.toFixed(2));
  history = history.slice(0, 25);
  saveHistory();

  io.emit("history", history);
  io.emit("crash", multiplier);

  // пауза перед новым раундом
  setTimeout(() => {
    startRound();
  }, 3000);
}



io.on("connection", async (socket) => {
  
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

    socket.emit("balance", user.balance);
    await user.save();
  });
  
  socket.on("getHistory", () => {
  socket.emit("history", history);
});

socket.on("cancelBet", async () => {
  user.nextBet = 0;
  await user.save();
});

  socket.on("cashout", async () => {
    if (!user.bet || user.cashedOut) return;
    if (gameInterval === null) return; // игра уже закончена

    const win = user.bet * multiplier;

    user.balance += win;
    user.cashedOut = true;

    socket.emit("balance", user.balance);
    await user.save();
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});
