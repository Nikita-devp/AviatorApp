const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

    addPlayer(socket.id, user);

    socket.emit("balance", user.balance);

    socket.on("bet", async (amount) => {
      if (amount > user.balance) return;
      if (getGameState() !== "WAITING") return;

      user.nextBet = amount;
      user.cashedOut = false;

      await user.save();

      const updatedUser = await User.findById(user._id);
      updatePlayer(socket.id, updatedUser);

      sendState(socket, updatedUser);
    });

    socket.on("cancelBet", async () => {
      user.nextBet = 0;
      await user.save();

      const updatedUser = await User.findById(user._id);
      updatePlayer(socket.id, updatedUser);

      sendState(socket, updatedUser);
    });

    socket.on("cashout", async () => {
      if (!user.bet || user.cashedOut) return;

      const win = user.bet * getMultiplier();

      user.balance += win;
      user.cashedOut = true;

      await user.save();

      const updatedUser = await User.findById(user._id);
      updatePlayer(socket.id, updatedUser);

      sendState(socket, updatedUser);
    });

    socket.on("disconnect", () => {
      removePlayer(socket.id);
    });

  });
}

module.exports = { attachSocket };