const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const mongoose = require("mongoose");

const { attachSocket } = require("./sockets/socket");
const { startRound, setIO } = require("./game/crashGame");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors({
  origin: ["https://www.lumoup.online"],
  credentials: true
}));

app.use(express.json());
app.use("/", authRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://www.lumoup.online"],
    credentials: true
  }
});

setIO(io);

// 🔥 передаём io в сокеты
attachSocket(io);

// статика
app.use(express.static(path.join(__dirname, "client/dist")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "client/dist/index.html"));
});

console.log("START CONNECT");

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log("✅ MongoDB connected");

  const PORT = process.env.PORT || 3001;

  server.listen(PORT, () => {
    console.log("🚀 SERVER RUNNING ON", PORT);

    startRound(); // 🔥 запускаем игру
  });

}).catch(err => console.error("❌ Mongo error:", err));