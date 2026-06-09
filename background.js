importScripts("game.js");

const Game = TomogachiGame;
const STORAGE_KEY = Game.STORAGE_KEY;

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || Game.createDefaultState(Date.now());
}

async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function updateBadge(state) {
  const now = Game.nowWithOffset(state);
  const display = Game.getDisplay(state, now);

  await chrome.action.setBadgeText({ text: display.badgeText });

  if (display.badgeText === "") {
    return;
  }

  if (display.badgeText === "Z") {
    await chrome.action.setBadgeBackgroundColor({ color: "#334155" });
  } else if (display.badgeText === "X" || display.badgeText === "!") {
    await chrome.action.setBadgeBackgroundColor({ color: "#991b1b" });
  } else {
    await chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  }
}

async function tickAndSave() {
  let state = await loadState();

  state = Game.tick(state, Game.nowWithOffset(state));

  await saveState(state);
  await updateBadge(state);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("tomogachiTick", { periodInMinutes: 1 });
  tickAndSave();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("tomogachiTick", { periodInMinutes: 1 });
  tickAndSave();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tomogachiTick") {
    tickAndSave();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "stateUpdated") {
    tickAndSave().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "getState") {
    loadState().then((state) => sendResponse({ state }));
    return true;
  }

  return false;
});
