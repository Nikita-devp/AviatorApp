const jwt = require("jsonwebtoken");
const User = require("../models/User");
let lastAction = 0;

const {
  getGameState,
  getMultiplier,
  addPlayer,
  removePlayer,
  updatePlayer
} = require("../game/crashGame");

function attachSocket(io) {
  io.on("connection", async (socket) => {

    function sendState(socket, user) {
      socket.emit("state", {
        gameState: getGameState(),
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

    const userId = decoded.userId;

    async function getFreshUser() {
    return await User.findById(userId);
}


    addPlayer(socket.id, user);

    socket.emit("balance", user.balance);

    socket.on("bet", async (amount) => {
  const user = await getFreshUser();
  const now = Date.now();
if (now - lastAction < 200) return;
lastAction = now;

  if (amount > user.balance) return;
  if (getGameState() !== "WAITING") return;
if (typeof amount !== "number" || isNaN(amount)) return;
if (amount <= 0) return;

  user.nextBet = amount;
  user.cashedOut = false;

  await user.save();

  updatePlayer(socket.id, user);
  sendState(socket, user);
});

    socket.on("cancelBet", async () => {
  const user = await getFreshUser();
  const now = Date.now();
if (now - lastAction < 200) return;
lastAction = now;

  user.nextBet = 0;
  await user.save();

  updatePlayer(socket.id, user);
  sendState(socket, user);
});

    socket.on("cashout", async () => {
  const user = await getFreshUser();
  const now = Date.now();
if (now - lastAction < 200) return;
lastAction = now;

  if (!user.bet || user.cashedOut) return;

  const win = user.bet * getMultiplier();

  user.balance += win;
  user.cashedOut = true;

  await user.save();

  updatePlayer(socket.id, user);
  sendState(socket, user);
});

    socket.on("disconnect", async () => {
  const user = await getFreshUser();

  if (user) {
    user.nextBet = 0;
    await user.save();
  }

  removePlayer(socket.id);
});

  });
}

module.exports = { attachSocket };