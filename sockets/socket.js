const jwt = require("jsonwebtoken");
const User = require("../models/User");
const lastActionMap = new Map();

const {
  getGameState,
  getMultiplier,
  addPlayer,
  removePlayer,
  updatePlayer,
  broadcastPlayers
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

   socket.on("bet", async (amount, cb) => {
  const user = await getFreshUser();

  if (typeof amount !== "number" || amount <= 0) {
    return cb?.({ success: false });
  }

  if (getGameState() !== "WAITING") {
    return cb?.({ success: false });
  }

  if (amount > user.balance) {
    return cb?.({ success: false });
  }

  user.balance -= amount;
  user.bet = amount;
  user.cashedOut = false;

  await user.save();

  updatePlayer(socket.id, user);
  broadcastPlayers();
  sendState(socket, user);

  cb?.({ success: true, balance: user.balance });
});

    socket.on("cancelBet", async (_, cb) => {
  const user = await getFreshUser();

  if (!user.bet) {
    return cb?.({ success: false });
  }

  user.balance += user.bet;
  user.bet = 0;
  user.cashedOut = false;

  await user.save();

  updatePlayer(socket.id, user);
  broadcastPlayers();
  sendState(socket, user);

  cb?.({ success: true });
});

socket.on("cashout", async (_, cb) => {
  const user = await getFreshUser();

  if (!user.bet || user.cashedOut) {
    return cb?.({ success: false });
  }

  const win = user.bet * getMultiplier();

  user.balance += win;
  user.bet = 0;
  user.cashedOut = true;

  await user.save();

  updatePlayer(socket.id, user);
  broadcastPlayers();
  sendState(socket, user);

  cb?.({ success: true });
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