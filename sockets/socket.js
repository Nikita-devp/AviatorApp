const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

    // ================= AUTH =================
    const token = socket.handshake.auth.token;
    if (!token) return socket.disconnect();

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return socket.disconnect();
    }

    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) return socket.disconnect();

    // ================= HELPERS =================
    async function getUser() {
      return await User.findById(userId);
    }

    function sendState(user) {
      socket.emit("state", {
  gameState,
  bet: user.bet,
  cashedOut: user.cashedOut,
  balance: user.balance
});
    }

    // ================= PLAYER JOIN =================
    addPlayer(socket.id, user);

    socket.emit("balance", user.balance);
    sendState(user);

    broadcastPlayers();

    // ================= BET =================
    socket.on("bet", async (amount, cb) => {
      const user = await getUser();

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
      sendState(user);

      cb?.({ success: true, balance: user.balance });
    });

    // ================= CANCEL BET =================
    socket.on("cancelBet", async (_, cb) => {
      const user = await getUser();

      if (!user.bet) {
        return cb?.({ success: false });
      }

      user.balance += user.bet;
      user.bet = 0;
      user.cashedOut = false;

      await user.save();

      updatePlayer(socket.id, user);
      broadcastPlayers();
      sendState(user);

      cb?.({ success: true, balance: user.balance });
    });

    // ================= CASHOUT =================
    socket.on("cashout", async (_, cb) => {
      const user = await getUser();

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
      sendState(user);

      cb?.({ success: true, balance: user.balance, win });
    });

    // ================= DISCONNECT =================
    socket.on("disconnect", async () => {
      removePlayer(socket.id);
    });

  });
}

module.exports = { attachSocket };