const Game = TomogachiGame;
const STORAGE_KEY = Game.STORAGE_KEY;

const petElement = document.getElementById("pet");
const statusElement = document.getElementById("status");
const stageElement = document.getElementById("stageText");
const timerElement = document.getElementById("timerText");
const nextNeedElement = document.getElementById("nextNeedText");

const hungerBar = document.getElementById("hunger");
const happinessBar = document.getElementById("happiness");
const energyBar = document.getElementById("energy");
const cleanBar = document.getElementById("cleanliness");

const petEggButton = document.getElementById("petEggButton");
const saladButton = document.getElementById("saladButton");
const friesButton = document.getElementById("friesButton");
const playButton = document.getElementById("playButton");
const cleanButton = document.getElementById("cleanButton");
const sleepButton = document.getElementById("sleepButton");
const wakeButton = document.getElementById("wakeButton");
const skipButton = document.getElementById("skipButton");
const resetButton = document.getElementById("resetButton");

const pongPanel = document.getElementById("pongPanel");
const pongCanvas = document.getElementById("pongCanvas");
const pongStatus = document.getElementById("pongStatus");
const upButton = document.getElementById("upButton");
const downButton = document.getElementById("downButton");
const closePongButton = document.getElementById("closePongButton");

const nameTitle = document.getElementById("nameTitle");
const nameBox = document.getElementById("nameBox");
const nameInput = document.getElementById("nameInput");
const saveNameButton = document.getElementById("saveNameButton");

let state;
let pong = null;
let pongAnimationId = null;
let isPlayingPong = false;
let isEndingPong = false;

const controls = {
  up: false,
  down: false
};

function getPongDifficulty() {
  if (state.stage === Game.STAGES.BABY) {
    return {
      label: "Baby mode",
      targetScore: 3,
      playerPaddleH: 52,
      enemyPaddleH: 26,
      enemySpeed: 0.5,
      ballVX: 1.7,
      ballVY: 1.1,
      speedGain: 0.03
    };
  }

  if (state.stage === Game.STAGES.ADULT) {
    return {
      label: "Adult mode",
      targetScore: 3,
      playerPaddleH: 34,
      enemyPaddleH: 34,
      enemySpeed: 2.4,
      ballVX: 2.5,
      ballVY: 1.8,
      speedGain: 0.12
    };
  }

  return {
    label: "Normal mode",
    targetScore: 3,
    playerPaddleH: 40,
    enemyPaddleH: 32,
    enemySpeed: 1.8,
    ballVX: 2,
    ballVY: 1.4,
    speedGain: 0.08
  };
}

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);

  state = result[STORAGE_KEY] || Game.createDefaultState(Date.now());
  state = Game.tick(state, Game.nowWithOffset(state));

  await saveState();
  render();
}

async function saveState() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });

  try {
    chrome.runtime.sendMessage({ type: "stateUpdated" });
  } catch (error) {
    console.log("Background message failed:", error);
  }
}

async function changeState(action) {
  const now = Game.nowWithOffset(state);

  state = action(state, now);

  await saveState();
  render();
}

function render() {
  if (!state) return;

  const now = Game.nowWithOffset(state);
  const display = Game.getDisplay(state, now);

  nameTitle.textContent = display.name || "Tomogachi";

  if (document.activeElement !== nameInput) {
    nameInput.value = display.name || "";
  }

  document.body.classList.toggle("sleep-mode", display.isSleeping);
  document.body.classList.toggle("dead-mode", display.isDead);

  petElement.textContent = display.sprite;
  statusElement.textContent = display.statusText;
  stageElement.textContent = `Stage: ${display.stageLabel}`;
  timerElement.textContent = display.timerText;
  nextNeedElement.textContent = display.nextNeedText;

  hungerBar.value = display.stats.hunger;
  happinessBar.value = display.stats.happiness;
  energyBar.value = display.stats.energy;
  cleanBar.value = display.stats.cleanliness;

  const isEgg = state.stage === Game.STAGES.EGG;
  const isDead = state.stage === Game.STAGES.DEAD;
  const isSleeping = state.isSleeping;
  const blocked = isEgg || isDead || isSleeping;

  petEggButton.classList.toggle("hidden", !isEgg || isDead);

  saladButton.classList.toggle("hidden", blocked);
  friesButton.classList.toggle("hidden", blocked);
  playButton.classList.toggle("hidden", blocked);
  cleanButton.classList.toggle("hidden", blocked);
  sleepButton.classList.toggle("hidden", blocked);
  wakeButton.classList.toggle("hidden", !isSleeping || isDead);

  nameBox.classList.toggle("hidden", !isEgg || isDead);
}

async function tickAndSave() {
  if (!state) return;

  const before = JSON.stringify(state);

  state = Game.tick(state, Game.nowWithOffset(state));

  if (JSON.stringify(state) !== before) {
    await saveState();
  }

  if (!isPlayingPong) {
    render();
  }
}

async function resetPet() {
  state = Game.createDefaultState(Date.now());

  await saveState();
  render();
}

async function startPong() {
  if (
    !state ||
    state.stage === Game.STAGES.EGG ||
    state.stage === Game.STAGES.DEAD ||
    state.isSleeping
  ) {
    return;
  }

  if (pong || isPlayingPong) {
    return;
  }

  if (typeof Game.attemptPlay === "function") {
    const playAttempt = Game.attemptPlay(state, Game.nowWithOffset(state));

    state = playAttempt.state;

    await saveState();
    render();

    if (!playAttempt.accepted) {
      return;
    }
  }

  isPlayingPong = true;
  isEndingPong = false;
  pongPanel.classList.remove("hidden");

  const difficulty = getPongDifficulty();

  pong = {
    width: pongCanvas.width,
    height: pongCanvas.height,

    playerY: 50,
    enemyY: 50,

    paddleW: 8,
    playerPaddleH: difficulty.playerPaddleH,
    enemyPaddleH: difficulty.enemyPaddleH,

    enemySpeed: difficulty.enemySpeed,
    targetScore: difficulty.targetScore,
    speedGain: difficulty.speedGain,

    ballX: pongCanvas.width / 2,
    ballY: pongCanvas.height / 2,
    ballVX: difficulty.ballVX,
    ballVY: difficulty.ballVY,
    ballSize: 6,

    score: 0,
    enemyScore: 0
  };

  pongStatus.textContent = `${difficulty.label}: first to 3 points wins.`;

  animatePong();
}

function closePong() {
  if (pongAnimationId) {
    cancelAnimationFrame(pongAnimationId);
    pongAnimationId = null;
  }

  pongPanel.classList.add("hidden");

  pong = null;
  isPlayingPong = false;
  isEndingPong = false;

  controls.up = false;
  controls.down = false;

  render();
}

function resetBall(direction = 1) {
  if (!pong) return;

  const difficulty = getPongDifficulty();

  pong.ballX = pong.width / 2;
  pong.ballY = pong.height / 2;
  pong.ballVX = difficulty.ballVX * direction;
  pong.ballVY = Math.random() > 0.5 ? difficulty.ballVY : -difficulty.ballVY;
}

async function finishPong(playerWon) {
  if (isEndingPong) {
    return;
  }

  isEndingPong = true;

  if (pongAnimationId) {
    cancelAnimationFrame(pongAnimationId);
    pongAnimationId = null;
  }

  pongPanel.classList.add("hidden");

  pong = null;
  isPlayingPong = false;

  controls.up = false;
  controls.down = false;

  if (playerWon) {
    const now = Game.nowWithOffset(state);
    state = Game.finishPlay(state, now);
    await saveState();
  }

  isEndingPong = false;

  render();
}

function animatePong() {
  if (!pong) return;

  const ctx = pongCanvas.getContext("2d");

  if (controls.up) pong.playerY -= 4;
  if (controls.down) pong.playerY += 4;

  pong.playerY = Math.max(
    0,
    Math.min(pong.height - pong.playerPaddleH, pong.playerY)
  );

  const enemyCenter = pong.enemyY + pong.enemyPaddleH / 2;

  if (enemyCenter < pong.ballY - 8) pong.enemyY += pong.enemySpeed;
  if (enemyCenter > pong.ballY + 8) pong.enemyY -= pong.enemySpeed;

  pong.enemyY = Math.max(
    0,
    Math.min(pong.height - pong.enemyPaddleH, pong.enemyY)
  );

  pong.ballX += pong.ballVX;
  pong.ballY += pong.ballVY;

  if (pong.ballY <= 0 || pong.ballY >= pong.height - pong.ballSize) {
    pong.ballVY *= -1;
  }

  const hitsPlayer =
    pong.ballVX < 0 &&
    pong.ballX <= 18 &&
    pong.ballX >= 10 &&
    pong.ballY + pong.ballSize >= pong.playerY &&
    pong.ballY <= pong.playerY + pong.playerPaddleH;

  const hitsEnemy =
    pong.ballVX > 0 &&
    pong.ballX + pong.ballSize >= pong.width - 18 &&
    pong.ballX <= pong.width - 10 &&
    pong.ballY + pong.ballSize >= pong.enemyY &&
    pong.ballY <= pong.enemyY + pong.enemyPaddleH;

  if (hitsPlayer) {
    pong.ballVX = Math.abs(pong.ballVX) + pong.speedGain;
    pong.ballX = 19;
  }

  if (hitsEnemy) {
    pong.ballVX = -Math.abs(pong.ballVX) - pong.speedGain;
    pong.ballX = pong.width - 25;
  }

  if (pong.ballX > pong.width) {
    pong.score += 1;
    pongStatus.textContent = `You: ${pong.score} / 3`;
    resetBall(-1);
  }

  if (pong.ballX < -pong.ballSize) {
    pong.enemyScore += 1;
    pongStatus.textContent = `Tomogachi: ${pong.enemyScore} / 3`;
    resetBall(1);
  }

  ctx.clearRect(0, 0, pong.width, pong.height);

  ctx.fillRect(10, pong.playerY, pong.paddleW, pong.playerPaddleH);
  ctx.fillRect(pong.width - 18, pong.enemyY, pong.paddleW, pong.enemyPaddleH);
  ctx.fillRect(pong.ballX, pong.ballY, pong.ballSize, pong.ballSize);

  ctx.font = "12px monospace";
  ctx.fillText(`You ${pong.score} / 3`, 72, 14);
  ctx.fillText(`Pet ${pong.enemyScore} / 3`, 72, 28);

  if (pong.score >= 3) {
    pongStatus.textContent = "You won! Tomogachi had fun.";

    finishPong(true).catch((error) => {
      console.error("Failed to finish Pong:", error);
      closePong();
    });

    return;
  }

  if (pong.enemyScore >= 3) {
    pongStatus.textContent = "Tomogachi won this round.";

    finishPong(false).catch((error) => {
      console.error("Failed to close Pong:", error);
      closePong();
    });

    return;
  }

  pongAnimationId = requestAnimationFrame(animatePong);
}

function bindHoldButton(button, key) {
  button.addEventListener("pointerdown", () => {
    controls[key] = true;
  });

  button.addEventListener("pointerup", () => {
    controls[key] = false;
  });

  button.addEventListener("pointerleave", () => {
    controls[key] = false;
  });

  button.addEventListener("pointercancel", () => {
    controls[key] = false;
  });
}

petEggButton.addEventListener("click", () => {
  changeState((currentState, now) => Game.petEgg(currentState, now));
});

saladButton.addEventListener("click", () => {
  changeState((currentState, now) => Game.feed(currentState, "salad", now));
});

friesButton.addEventListener("click", () => {
  changeState((currentState, now) => Game.feed(currentState, "fries", now));
});

playButton.addEventListener("click", () => {
  startPong().catch((error) => {
    console.error("Pong failed to start:", error);
  });
});

cleanButton.addEventListener("click", () => {
  changeState((currentState, now) => Game.clean(currentState, now));
});

sleepButton.addEventListener("click", () => {
  changeState((currentState, now) => Game.sleep(currentState, now));
});

wakeButton.addEventListener("click", () => {
  changeState((currentState, now) => Game.wakeUp(currentState, now));
});

saveNameButton.addEventListener("click", () => {
  changeState((currentState, now) => {
    return Game.setName(currentState, nameInput.value, now);
  });
});

nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveNameButton.click();
  }
});

skipButton.addEventListener("click", () => {
  changeState((currentState, now) => Game.skipTestTime(currentState, now));
});

resetButton.addEventListener("click", () => {
  const confirmed = confirm(
    "Are you sure you want to reset your Tomogachi? This cannot be undone."
  );

  if (confirmed) {
    resetPet();
  }
});

closePongButton.addEventListener("click", closePong);

bindHoldButton(upButton, "up");
bindHoldButton(downButton, "down");

loadState();

setInterval(() => {
  if (!isPlayingPong) {
    render();
  }
}, 1000);

setInterval(tickAndSave, 5000);
