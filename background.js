importScripts("game.js");

const Game = TomogachiGame;
const STORAGE_KEY = Game.STORAGE_KEY;
const LAST_BADGE_KEY = "tomogachiLastBadgeText";

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || Game.createDefaultState(Date.now());
}

async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}
async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play a small sound when Tomogachi needs attention."
  });
}

async function playNotificationSound() {
  await ensureOffscreenDocument();

  chrome.runtime.sendMessage({
    type: "playNotificationSound"
  });
}
async function updateBadge(state) {
  const now = Game.nowWithOffset(state);
  const display = Game.getDisplay(state, now);

  const badgeText = display.badgeText || "";

  const result = await chrome.storage.local.get(LAST_BADGE_KEY);
  const previousBadgeText = result[LAST_BADGE_KEY] || "";

  await chrome.action.setBadgeText({ text: badgeText });

  if (badgeText === "") {
    await chrome.storage.local.set({ [LAST_BADGE_KEY]: "" });
    return;
  }

  if (badgeText === "Z") {
    await chrome.action.setBadgeBackgroundColor({ color: "#334155" });
  } else if (badgeText === "X" || badgeText === "!") {
    await chrome.action.setBadgeBackgroundColor({ color: "#991b1b" });
  } else {
    await chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  }

  const notificationJustAppeared = previousBadgeText === "" && badgeText !== "";

  if (notificationJustAppeared) {
    await playNotificationSound();
  }

  await chrome.storage.local.set({ [LAST_BADGE_KEY]: badgeText });
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
