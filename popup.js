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
const skipButton = document.getElementById("skipButton");
const resetButton = document.getElementById("resetButton");

const pongPanel = document.getElementById("pongPanel");
const pongCanvas = document.getElementById("pongCanvas");
const pongStatus = document.getElementById("pongStatus");
const upButton = document.getElementById("upButton");
const downButton = document.getElementById("downButton");
const closePongButton = document.getElementById("closePongButton");

let state;
let pong = null;
let pongAnimationId = null;

const controls = {
  up: false,
  down: false
};

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);

  state = result[STORAGE_KEY] || Game.createDefaultState(Date.now());
  state = Game.tick(state, Game.nowWithOffset(state));

  await saveState();
  render();
}

async function saveState() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  chrome.runtime.sendMessage({ type: "stateUpdated" }).catch(() => {});
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

  petEggButton.disabled = !isEgg || isDead;
  saladButton.disabled = blocked;
  friesButton.disabled = blocked;
  playButton.disabled = blocked;
  cleanButton.disabled = blocked;
  sleepButton.disabled = blocked;
}

async function tickAndSave() {
  if (!state) return;

  const before = JSON.stringify(state);

  state = Game.tick(state, Game.nowWithOffset(state));

  if (JSON.stringify(state) !== before) {
    await saveState();
  }

  render();
}

async function resetPet() {
  state = Game.createDefaultState(Date.now());

  await saveState();
  render();
}

function startPong() {
  if (!state || state.stage === Game.STAGES.EGG || state.stage === Game.STAGES.DEAD || state.isSleeping) {
    return;
  }

  pongPanel.classList.remove("hidden");

  pong = {
    width: pongCanvas.width,
    height: pongCanvas.height,
    playerY: 50,
    enemyY: 50,
    paddleW: 8,
    paddleH: 34,
    ballX: 110,
    ballY: 70,
    ballVX: 2.4,
    ballVY: 1.8,
    ballSize: 6,
    score: 0,
    enemyScore: 0
  };

  pongStatus.textContent = "Score 3 points to finish playing.";

  animatePong();
}

function closePong() {
  pongPanel.classList.add("hidden");
  pong = null;

  if (pongAnimationId) {
    cancelAnimationFrame(pongAnimationId);
    pongAnimationId = null;
  }
}

function resetBall(direction = 1) {
  pong.ballX = pong.width / 2;
  pong.ballY = pong.height / 2;
  pong.ballVX = 2.4 * direction;
  pong.ballVY = Math.random() > 0.5 ? 1.8 : -1.8;
}

async function finishPong() {
  closePong();

  await changeState((currentState, now) => {
    return Game.finishPlay(currentState, now);
  });
}

function animatePong() {
  if (!pong) return;

  const ctx = pongCanvas.getContext("2d");

  if (controls.up) pong.playerY -= 4;
  if (controls.down) pong.playerY += 4;

  pong.playerY = Math.max(0, Math.min(pong.height - pong.paddleH, pong.playerY));

  const enemyCenter = pong.enemyY + pong.paddleH / 2;

  if (enemyCenter < pong.ballY - 8) pong.enemyY += 2;
  if (enemyCenter > pong.ballY + 8) pong.enemyY -= 2;

  pong.enemyY = Math.max(0, Math.min(pong.height - pong.paddleH, pong.enemyY));

  pong.ballX += pong.ballVX;
  pong.ballY += pong.ballVY;

  if (pong.ballY <= 0 || pong.ballY >= pong.height - pong.ballSize) {
    pong.ballVY *= -1;
  }

  const hitsPlayer =
    pong.ballX <= 18 &&
    pong.ballX >= 10 &&
    pong.ballY + pong.ballSize >= pong.playerY &&
    pong.ballY <= pong.playerY + pong.paddleH;

  const hitsEnemy =
    pong.ballX + pong.ballSize >= pong.width - 18 &&
    pong.ballX <= pong.width - 10 &&
    pong.ballY + pong.ballSize >= pong.enemyY &&
    pong.ballY <= pong.enemyY + pong.paddleH;

  if (hitsPlayer) {
    pong.ballVX = Math.abs(pong.ballVX) + 0.15;
  }

  if (hitsEnemy) {
    pong.ballVX = -Math.abs(pong.ballVX) - 0.05;
  }

  if (pong.ballX > pong.width) {
    pong.score += 1;
    pongStatus.textContent = `Score: ${pong.score} / 3`;
    resetBall(-1);
  }

  if (pong.ballX < -pong.ballSize) {
    pong.enemyScore += 1;
    pongStatus.textContent = `Missed. Score: ${pong.score} / 3`;
    resetBall(1);
  }

  ctx.clearRect(0, 0, pong.width, pong.height);
  ctx.fillRect(10, pong.playerY, pong.paddleW, pong.paddleH);
  ctx.fillRect(pong.width - 18, pong.enemyY, pong.paddleW, pong.paddleH);
  ctx.fillRect(pong.ballX, pong.ballY, pong.ballSize, pong.ballSize);
  ctx.font = "12px monospace";
  ctx.fillText(`${pong.score} / 3`, 92, 14);

  if (pong.score >= 3) {
    finishPong();
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

playButton.addEventListener("click", startPong);

cleanButton.addEventListener("click", () => {
  changeState((currentState, now) => Game.clean(currentState, now));
});

sleepButton.addEventListener("click", () => {
  changeState((currentState, now) => Game.sleep(currentState, now));
});

skipButton.addEventListener("click", () => {
  changeState((currentState, now) => Game.skipTestTime(currentState, now));
});

resetButton.addEventListener("click", resetPet);
closePongButton.addEventListener("click", closePong);

bindHoldButton(upButton, "up");
bindHoldButton(downButton, "down");

loadState();

setInterval(render, 1000);
setInterval(tickAndSave, 5000);
