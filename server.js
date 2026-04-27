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

const { attachSocket } = require("./sockets/socket");
const { startRound } = require("./game/crashGame");
const User = require("./models/User");
const authRoutes = require("./routes/auth");
app.use("/", authRoutes);


const app = express();

// ✅ CORS
app.use(cors({
	origin: ["https://www.lumoup.online"],
	credentials: true
	}));
	
	app.use(express.json());
		
		
		const server = http.createServer(app);
		
		const io = new Server(server, {
			cors: {
				origin: ["https://www.lumoup.online"],
			credentials: true }
			});
			attachSocket(io);
					
									
					
app.use(express.static(path.join(__dirname, "client/dist")));
									
app.use((req, res) => {
	res.sendFile(path.join(__dirname, "client/dist/index.html"));
});
										
										
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
players[socketId] = user;
sendState(io.to(socketId), user);
			}
		}
	}
}
												
setTimeout(async () => {
  gameState = "RUNNING";

  for (let socketId in players) {
    const userId = players[socketId]._id;
    const freshUser = await User.findById(userId);

    players[socketId] = freshUser;

    io.to(socketId).emit("state", {
      gameState,
      bet: freshUser.bet,
      nextBet: freshUser.nextBet,
      cashedOut: freshUser.cashedOut,
      balance: freshUser.balance
    });
  }

  gameInterval = setInterval(() => {
    multiplier += 0.02;
    io.emit("tick", multiplier);

    if (multiplier >= crashPoint) {
      clearInterval(gameInterval);
      gameInterval = null;
      endRound();
    }
  }, 100);

}, 1000);
											}
											
											async function endRound() {
  history.unshift(multiplier.toFixed(2));
  history = history.slice(0, 25);
  saveHistory();

  io.emit("history", history);

  gameState = "CRASHED";
  
  for (let socketId in players) {
  const freshUser = await User.findById(players[socketId]._id);

  players[socketId] = {
  _id: freshUser._id
};

  io.to(socketId).emit("state", {
    gameState,
    bet: freshUser.bet,
    nextBet: freshUser.nextBet,
    cashedOut: freshUser.cashedOut,
    balance: freshUser.balance
  });
}

  io.emit("crash", multiplier);

  // ⬇️ через 2 секунды старт таймера
  setTimeout(() => {
    startCountdown();
  }, 3000);
}

let countdown = 10;
let countdownInterval = null;

function startCountdown() {
  gameState = "STARTING";
  countdown = 10;

  io.emit("state", {
    gameState,
    countdown
  });

  countdownInterval = setInterval(() => {
    countdown--;

    io.emit("state", {
      gameState,
      countdown
    });

    if (countdown <= 0) {
      clearInterval(countdownInterval);
      startRound();
    }
  }, 1000);
}

											
										
									
									
console.log("START CONNECT");
mongoose.connect(process.env.MONGO_URI).then(() => { console.log("✅ MongoDB connected");
const PORT = process.env.PORT || 3001;
									
server.listen(PORT, () => {
console.log("🚀 SERVER RUNNING ON", PORT);
startRound();
});
})
.catch(err => console.error("❌ Mongo error:", err));

									
									
									