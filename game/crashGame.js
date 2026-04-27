let multiplier = 1;
let gameState = "WAITING";
let crashPoint = generateCrash();
let gameInterval = null;
let players = {};
let io;

function setIO(_io) {
  io = _io;
}

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


async function startRound() {
	gameState = "WAITING";
	multiplier = 1;
	crashPoint = generateCrash();

io.emit("state", {
  gameState,
  countdown: 0
});

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

function addPlayer(socketId, user) {
  players[socketId] = user;
}

function removePlayer(socketId) {
  delete players[socketId];
}

function updatePlayer(socketId, user) {
  players[socketId] = user;
}

function getPlayers() {
  return players;
}


module.exports = {
  startRound,
  setIO, // 🔥 ВОТ ЭТО ДОБАВЬ

  getGameState: () => gameState,
  getMultiplier: () => multiplier,

  addPlayer,
  removePlayer,
  updatePlayer,
  getPlayers
};