(function (global) {
  const MINUTE = 60 * 1000;
  const SECOND = 1000;

  const STORAGE_KEY = "tomogachiState";

  const STAGES = {
    EGG: "egg",
    BABY: "baby",
    ADULT: "adult",
    DEAD: "dead"
  };

  const NEEDS = ["food", "play", "clean", "sleep"];

  const CONFIG = {
    eggDurationMs: 5 * MINUTE,
    petEggBonusMs: 30 * SECOND,
    babyDurationMs: 2 * 60 * MINUTE,
    neglectGraceMs: 5 * MINUTE,
    testSkipMs: 2.5 * MINUTE,

    baby: {
      food: [10, 15],
      play: [20, 25],
      clean: [30, 35],
      sleep: [105, 110]
    },

    adult: {
      food: [20, 30],
      play: [60, 70],
      sleep: [120, 130]
    }
  };

  function nowWithOffset(state) {
    return Date.now() + (state.timeOffsetMs || 0);
  }

  function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  function randomMinutes(min, max) {
    return (min + Math.random() * (max - min)) * MINUTE;
  }

  function getNeedConfig(stage) {
    if (stage === STAGES.BABY) return CONFIG.baby;
    if (stage === STAGES.ADULT) return CONFIG.adult;
    return null;
  }

  function createDefaultState(now = Date.now()) {
    return {
      version: 2,
      name: "Tomogachi",
      stage: STAGES.EGG,
      createdAt: now,
      stageStartedAt: now,
      eggHatchAt: now + CONFIG.eggDurationMs,
      lastTickAt: now,
      timeOffsetMs: 0,

      stats: {
        hunger: 0,
        happiness: 50,
        energy: 70,
        cleanliness: 100
      },

      health: 100,
      unhealthyDebt: 0,
      isSleeping: false,
      sleepEndsAt: null,
      energyBeforeSleep: null,

      history: [],
      lastOpenedAt: now,
      lastMorningGreetingDate: null,
      lastRareEventAt: 0,
      soundEnabled: true,

      needs: {
        food: null,
        play: null,
        clean: null,
        sleep: null
      },

      nextNeedAt: {
        food: null,
        play: null,
        clean: null,
        sleep: null
      },

      deathAt: null,
      message: "The egg is waiting. Pet it to hatch faster."
    };
  }

  function sanitizeState(input, now = Date.now()) {
    const fresh = createDefaultState(now);
    const state = { ...fresh, ...(input || {}) };

    state.stats = { ...fresh.stats, ...(input && input.stats ? input.stats : {}) };
    state.needs = { ...fresh.needs, ...(input && input.needs ? input.needs : {}) };
    state.nextNeedAt = { ...fresh.nextNeedAt, ...(input && input.nextNeedAt ? input.nextNeedAt : {}) };

    if (!Array.isArray(state.history)) state.history = [];
    if (!state.lastOpenedAt) state.lastOpenedAt = now;
    if (!state.lastMorningGreetingDate) state.lastMorningGreetingDate = null;
    if (typeof state.lastRareEventAt !== "number") state.lastRareEventAt = 0;
    if (typeof state.soundEnabled !== "boolean") state.soundEnabled = true;
    if (!state.stage) state.stage = STAGES.EGG;
    if (!state.createdAt) state.createdAt = now;
    if (!state.stageStartedAt) state.stageStartedAt = now;
    if (!state.eggHatchAt) state.eggHatchAt = now + CONFIG.eggDurationMs;
    if (!state.lastTickAt) state.lastTickAt = now;
    if (typeof state.timeOffsetMs !== "number") state.timeOffsetMs = 0;
    if (typeof state.health !== "number") state.health = 100;
    if (typeof state.unhealthyDebt !== "number") state.unhealthyDebt = 0;

    for (const key of Object.keys(state.stats)) {
      state.stats[key] = clamp(Number(state.stats[key]) || 0);
    }

    state.health = clamp(state.health);
    state.unhealthyDebt = clamp(state.unhealthyDebt);

    return state;
  }

  function scheduleNeed(state, need, now) {
    const config = getNeedConfig(state.stage);
    if (!config || !config[need]) return;

    const [min, max] = config[need];
    state.needs[need] = null;
    state.nextNeedAt[need] = now + randomMinutes(min, max);
  }

  function scheduleAllNeeds(state, now) {
    for (const need of NEEDS) {
      scheduleNeed(state, need, now);
    }
  }

  function enterStage(state, stage, now) {
    state.stage = stage;
    state.stageStartedAt = now;
    state.lastTickAt = now;
    state.isSleeping = false;
    state.sleepEndsAt = null;

    for (const need of NEEDS) {
      state.needs[need] = null;
      state.nextNeedAt[need] = null;
    }

    if (stage === STAGES.BABY) {
      state.stats.hunger = 20;
      state.stats.happiness = 60;
      state.stats.energy = 80;
      state.stats.cleanliness = 100;
      state.message = "It hatched into a baby Tomogachi.";
      scheduleAllNeeds(state, now);
    }

    if (stage === STAGES.ADULT) {
      state.stats.hunger = clamp(state.stats.hunger - 15);
      state.stats.happiness = clamp(state.stats.happiness + 15);
      state.stats.energy = clamp(state.stats.energy + 15);
      state.stats.cleanliness = clamp(state.stats.cleanliness + 20);
      state.message = "Your Tomogachi evolved into an adult.";
      scheduleAllNeeds(state, now);
    }
  }

  function formatClock(now) {
    return new Date(now).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function pushHistory(state, text, now) {
    state.history = [
      { text, time: formatClock(now) },
      ...(state.history || [])
    ].slice(0, 5);
  }

  function setMessage(state, text, now = nowWithOffset(state), addToHistory = true) {
    state.message = text;
  
    if (addToHistory) {
      pushHistory(state, text, now);
    }
  }

  function noteOpened(state, now = nowWithOffset(state)) {
    state = tick(state, now);
  
    const awayMs = state.lastOpenedAt ? now - state.lastOpenedAt : 0;
    const currentDateKey = new Date(now).toDateString();
    const currentHour = new Date(now).getHours();
  
    if (
      currentHour < 12 &&
      state.lastMorningGreetingDate !== currentDateKey &&
      state.stage !== STAGES.DEAD
    ) {
      state.lastMorningGreetingDate = currentDateKey;
      setMessage(state, "Good morning. I dreamed about browser cookies.", now);
    } else if (awayMs >= 2 * 60 * MINUTE && state.stage !== STAGES.DEAD) {
      setMessage(state, "I thought you had forgotten me.", now);
    }
  
    state.lastOpenedAt = now;
    return state;
  }

  function maybeRareEvent(state, now = nowWithOffset(state)) {
    if (
      state.stage === STAGES.EGG ||
      state.stage === STAGES.DEAD ||
      state.isSleeping
    ) {
      return state;
    }
  
    if (now - state.lastRareEventAt < 30 * MINUTE) {
      return state;
    }
  
    const chance = Math.random();
  
    if (chance < 0.06) {
      const events = [
        `${state.name || "Tomogachi"} found a mysterious pixel crumb.`,
        `${state.name || "Tomogachi"} sneezed with dramatic intensity.`,
        `${state.name || "Tomogachi"} stared into the void for a full minute.`,
        `${state.name || "Tomogachi"} invented a game you are not allowed to understand.`,
        `${state.name || "Tomogachi"} hums a tiny song to itself.`
      ];
  
      const chosen = events[Math.floor(Math.random() * events.length)];
      state.lastRareEventAt = now;
      setMessage(state, chosen, now);
    }
  
    return state;
  }

  function startSleep(state, now, minutes = 10 + Math.random() * 5) {
    state.isSleeping = true;
    state.sleepEndsAt = now + minutes * MINUTE;
    state.energyBeforeSleep = state.stats.energy;
    state.needs.sleep = null;
    state.nextNeedAt.sleep = null;
    state.message = `${state.name || "Tomogachi"} curled up and fell asleep.`;
  }

  function killPet(state, now) {
    state.stage = STAGES.DEAD;
    state.deathAt = now;
    state.isSleeping = false;
    state.sleepEndsAt = null;
    state.health = 0;
    state.message = "Your Tomogachi got too sick and departed.";

    for (const need of NEEDS) {
      state.needs[need] = null;
      state.nextNeedAt[need] = null;
    }
  }

  function tick(state, now = nowWithOffset(state)) {
    state = sanitizeState(state, now);

    if (state.stage === STAGES.DEAD) {
      return state;
    }

    if (now < state.lastTickAt) {
      state = maybeRareEvent(state, now);
      state.lastTickAt = now;
      return state;
    }

    const elapsedMs = now - state.lastTickAt;
    const elapsedMinutes = elapsedMs / MINUTE;

    if (state.stage === STAGES.EGG) {
      if (now >= state.eggHatchAt) {
        enterStage(state, STAGES.BABY, now);
      } else {
        state.lastTickAt = now;
      }

      return state;
    }

    if (state.stage === STAGES.BABY && now - state.stageStartedAt >= CONFIG.babyDurationMs) {
      enterStage(state, STAGES.ADULT, now);
      return state;
    }

    if (state.isSleeping) {
      state.stats.energy = clamp(state.stats.energy + elapsedMinutes * 8);

    if (now >= state.sleepEndsAt) {
      state.isSleeping = false;
      state.sleepEndsAt = null;
      state.energyBeforeSleep = null;
      state.stats.energy = 100;
      state.message = `${state.name || "Tomogachi"} woke up fully rested.`;
      scheduleNeed(state, "sleep", now);
    }
    } else {
      state.stats.energy = clamp(state.stats.energy - elapsedMinutes * 0.3);
    }

    state.unhealthyDebt = clamp(state.unhealthyDebt - elapsedMinutes * 0.5);

    const config = getNeedConfig(state.stage);

    if (config && !state.isSleeping) {
      for (const need of NEEDS) {
        if (state.nextNeedAt[need] && now >= state.nextNeedAt[need] && !state.needs[need]) {
          if (state.stage === STAGES.ADULT && need === "sleep") {
            startSleep(state, now);
          } else {
            state.needs[need] = {
              since: state.nextNeedAt[need]
            };

            state.nextNeedAt[need] = null;
          }
        }
      }
    }

    if (state.needs.food) {
      state.stats.hunger = clamp(state.stats.hunger + elapsedMinutes * 5);
    }

    if (state.needs.play) {
      state.stats.happiness = clamp(state.stats.happiness - elapsedMinutes * 2);
    }

    if (state.needs.clean) {
      state.stats.cleanliness = clamp(state.stats.cleanliness - elapsedMinutes * 4);
    }

    if (state.needs.sleep && !state.isSleeping) {
      state.stats.energy = clamp(state.stats.energy - elapsedMinutes * 1.5);
    }

    let neglectDamage = 0;

    for (const need of NEEDS) {
      const activeNeed = state.needs[need];
      if (!activeNeed) continue;

      const penaltyStartsAt = activeNeed.since + CONFIG.neglectGraceMs;
      const damageStart = Math.max(state.lastTickAt, penaltyStartsAt);

      if (now > damageStart) {
        const overdueMinutes = (now - damageStart) / MINUTE;
        neglectDamage += overdueMinutes * 2.5;
      }
    }

    if (neglectDamage > 0) {
      const unhealthyMultiplier = 1 + state.unhealthyDebt / 80;
      state.health = clamp(state.health - neglectDamage * unhealthyMultiplier);
    }

    if (state.health <= 0) {
      killPet(state, now);
      return state;
    }

    if (state.health <= 25) {
      state.message = "Your Tomogachi is sick. Take better care of it.";
    }

    state.lastTickAt = now;
    return state;
  }

  function getAdultAgeLabel(state, now) {
    if (state.stage !== STAGES.ADULT) return "Adult";
  
    const adultAge = now - state.stageStartedAt;
  
    if (adultAge < 30 * MINUTE) return "Young Adult";
    if (adultAge < 90 * MINUTE) return "Adult";
    return "Elder";
  }

  function wakeUp(state, now = nowWithOffset(state)) {
    state = tick(state, now);
  
    if (state.stage === STAGES.DEAD || !state.isSleeping) {
      return state;
    }
  
    state.isSleeping = false;
    state.sleepEndsAt = null;
  
    if (typeof state.energyBeforeSleep === "number") {
      state.stats.energy = state.energyBeforeSleep;
    }
  
    state.energyBeforeSleep = null;
    state.message = (state, `${state.name || "Tomogachi"} was woken up by the bell and looks betrayed.`, now);
  
    scheduleNeed(state, "sleep", now);
  
    return state;
  }

  function petEgg(state, now = nowWithOffset(state)) {
    state = tick(state, now);

    if (state.stage !== STAGES.EGG) return state;

    state.eggHatchAt = Math.max(now + 10 * SECOND, state.eggHatchAt - CONFIG.petEggBonusMs);
    state.message = (state, "The egg moved. Hatching got faster.", now);

    return tick(state, now);
  }

  function setName(state, newName, now = nowWithOffset(state)) {
    state = tick(state, now);
  
    if (state.stage !== STAGES.EGG) {
      state.message = (state,`${state.name || "Tomogachi"} already knows who it is.`, now);
      return state;
    }
  
    const cleanName = String(newName || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 16);
  
    state.name = cleanName || "Tomogachi";
    state.message = (state,`${state.name} accepts this name from inside the egg.`, now);
  
    return state;
  }
  
  function feed(state, foodType, now = nowWithOffset(state)) {
    state = tick(state, now);

    if (state.stage === STAGES.EGG || state.stage === STAGES.DEAD || state.isSleeping) {
      return state;
    }

    if (foodType === "fries") {
      state.stats.hunger = clamp(state.stats.hunger - 45);
      state.stats.happiness = clamp(state.stats.happiness + 12);
      state.unhealthyDebt = clamp(state.unhealthyDebt + 25);
      setMessage(state, "This is the greatest day of my short digital life.", now);
    } else {
      state.stats.hunger = clamp(state.stats.hunger - 25);
      state.health = clamp(state.health + 5);
      state.unhealthyDebt = clamp(state.unhealthyDebt - 15);
      setMessage(state, `${state.name || "Tomogachi"} ate salad and feels weirdly responsible.`, now);
    }
    scheduleNeed(state, "food", now);
    return state;
  }

  function finishPlay(state, now = nowWithOffset(state)) {
    state = tick(state, now);

    if (state.stage === STAGES.EGG || state.stage === STAGES.DEAD || state.isSleeping) {
      return state;
    }

    state.stats.happiness = clamp(state.stats.happiness + 22);
    state.stats.energy = clamp(state.stats.energy - 12);
    state.stats.hunger = clamp(state.stats.hunger + 8);
    state.message = (state, "Tomogachi had fun playing Pong.", now);

    scheduleNeed(state, "play", now);
    return state;
  }

  function clean(state, now = nowWithOffset(state)) {
    state = tick(state, now);

    if (state.stage === STAGES.EGG || state.stage === STAGES.DEAD || state.isSleeping) {
      return state;
    }

    state.stats.cleanliness = 100;
    state.health = clamp(state.health + 3);
    state.message = (state, "Tomogachi is clean now.", now);

    scheduleNeed(state, "clean", now);
    return state;
  }

  function sleep(state, now = nowWithOffset(state)) {
    state = tick(state, now);

    if (state.stage === STAGES.EGG || state.stage === STAGES.DEAD || state.isSleeping) {
      return state;
    }

    startSleep(state, now, 10);
    return state;
  }

  function skipTestTime(state, now = nowWithOffset(state)) {
    state = sanitizeState(state, now);
    state.timeOffsetMs += CONFIG.testSkipMs;
    return tick(state, nowWithOffset(state));
  }

  function formatDuration(ms) {
    if (ms <= 0) return "now";

    const totalSeconds = Math.floor(ms / SECOND);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function makeEggSprite() {
  return [
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⢀⣀⣀⡀⠀⠀⠀",
    "⠀⠀⠀⠀⢰⣿⣿⣿⣿⡆⠀⠀",
    "⠀⠀⠀⢀⣿⣿⣿⣿⣿⣿⡀⠀",
    "⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⡇⠀",
    "⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⠃⠀",
    "⠀⠀⠀⠀⠈⠛⠛⠛⠛⠁⠀⠀"
  ].join("\n");
}

  function makeTombstoneSprite(name = "Tomogachi") {
    return [
      "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
      "⠀⠀⠀⠀⢀⣤⣤⣤⣤⡀⠀⠀",
      "⠀⠀⠀⢠⣿⣿⣿⣿⣿⣿⡄⠀",
      "⠀⠀⠀⢸⣿⠀R.I.P⠀⣿⡇⠀",
      `⠀⠀⠀⢸⣿⠀${name.slice(0, 8).padEnd(8, " ")}⠀⣿⡇⠀`,
      "⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⡇⠀",
      "⠀⠀⠛⠛⠛⠛⠛⠛⠛⠛⠛⠀"
    ].join("\n");
  }
  function makeSprite(face) {
    return [
      "⠀⠀⠀⠀⠀⠀⠀⠀⡴⠒⢦⠀⠀⠀⡴⠲⣄",
      "⠀⠀⠀⠀⠀⠀⠀⠀⡇⡄⢸⠀⠀⠀⡇⡀⢹",
      "⠀⠀⠀⠀⠀⠀⠀⣀⡧⠷⠚⠓⠒⠦⠧⣇⣸",
      "⠀⠀⠀⠀⠀⠀⢰⠃⠀⠀⠀⠀⠀⠀⠀⠀⠈⢧",
      `⠀⠀⠀⠀⠀⠀⠘⡆⠀${face}⠀⢈⡇`,
      "⠀⠀⠀⠀⠀⠀⠀⠙⠶⠤⠤⠤⠤⠤⠤⠤⠖⠋"
    ].join("\n");
  }

  function getFace(state) {
    if (state.stage === STAGES.DEAD) return "x⠀⠀.⠀⠀x";
    if (state.stage === STAGES.EGG) return "0⠀⠀⠐⠀⠀0";
    if (state.isSleeping) return "_⠀⠀.⠀⠀_";
    if (state.health <= 25) return "e⠀⠀.⠀⠀e";
    if (state.needs.clean) return "o⠀...⠀o";
    if (state.needs.food) return "⠂⠀⠀o⠀⠀⠂";
    if (state.needs.play) return "⠈⠀⠀u⠀⠀⠈";
    if (state.needs.sleep) return "-⠀⠀⠐⠀⠀-";
    if (state.stats.happiness >= 75 && state.stats.hunger <= 35) return "⠈⠀⠀⠐⠀⠀⠈";

    return "⠐⠀⠀⠐⠀⠀⠐";
  }

  function getActiveNeeds(state) {
    return NEEDS.filter((need) => Boolean(state.needs[need]));
  }

  function getBadgeText(state, now = nowWithOffset(state)) {
    if (state.stage === STAGES.DEAD) return "X";
    if (state.health <= 25) return "!";
    if (state.isSleeping) return "Z";

    const activeNeeds = getActiveNeeds(state);

    if (activeNeeds.length === 0) return "";

    const hasOverdueNeed = activeNeeds.some((need) => {
      return now - state.needs[need].since >= CONFIG.neglectGraceMs;
    });

    return hasOverdueNeed ? "!" : String(activeNeeds.length);
  }

  function getTimerText(state, now = nowWithOffset(state)) {
    if (state.stage === STAGES.EGG) {
      return `Hatches in ${formatDuration(state.eggHatchAt - now)}`;
    }

    if (state.stage === STAGES.BABY) {
      return `Evolves in ${formatDuration(state.stageStartedAt + CONFIG.babyDurationMs - now)}`;
    }

    if (state.stage === STAGES.ADULT) {
      return `Adult age: ${formatDuration(now - state.stageStartedAt)}`;
    }

    if (state.stage === STAGES.DEAD) {
      return "Departed";
    }

    return "";
  }

  function getNextNeedText(state, now = nowWithOffset(state)) {
    if (state.stage === STAGES.EGG || state.stage === STAGES.DEAD) return "";
    if (state.isSleeping) return `Wakes in ${formatDuration(state.sleepEndsAt - now)}`;

    const activeNeeds = getActiveNeeds(state);

    if (activeNeeds.length > 0) {
      return `Needs: ${activeNeeds.join(", ")}`;
    }

    let soonestNeed = null;
    let soonestTime = Infinity;

    for (const need of NEEDS) {
      const dueAt = state.nextNeedAt[need];

      if (dueAt && dueAt < soonestTime) {
        soonestTime = dueAt;
        soonestNeed = need;
      }
    }

    if (!soonestNeed) return "No needs scheduled yet.";

    return `Next: ${soonestNeed} in ${formatDuration(soonestTime - now)}`;
  }

  function getStatusText(state) {
    const name = state.name || "Tomogachi";

      if (state.message) return state.message;

    if (state.stage === STAGES.DEAD) {
      return `${state.name || "Tomogachi"} has left this tiny world.`;
    }
  
    if (state.stage === STAGES.EGG) {
      return "The egg is quiet, but something inside is listening.";
    }
  
    if (state.isSleeping) {
      return `${state.name || "Tomogachi"} is asleep and probably judging you in a dream.`;
    }
  
    return `${state.name || "Tomogachi"} is vibing quietly.`;
  }
    
    if (state.stage === STAGES.DEAD) {
      return `${name} has left this tiny world.`;
    }
  
    if (state.stage === STAGES.EGG) {
      const eggMessages = [
        "Something inside the egg taps back.",
        "The egg wiggles like it heard you.",
        "A tiny heartbeat echoes from inside.",
        "The egg is warm. It wants attention.",
        "The shell shakes with mysterious determination."
      ];
  
      return state.message || eggMessages[Math.floor(Math.random() * eggMessages.length)];
    }
  
    if (state.isSleeping) {
      const sleepMessages = [
        `${name} is dreaming of pixel snacks.`,
        `${name} is asleep. The room feels quieter.`,
        `${name} has entered battery-saving mode.`,
        `${name} is snoring in lowercase.`
      ];
  
      return sleepMessages[Math.floor(Math.random() * sleepMessages.length)];
    }
  
    if (state.health <= 25) {
      return `${name} looks fragile. It needs care soon.`;
    }
  
    if (state.needs.clean) {
      return `${name} has created a biohazard situation.`;
    }
  
    if (state.needs.food) {
      return `${name} is staring at you like you are the fridge.`;
    }
  
    if (state.needs.play) {
      return `${name} is bouncing with dangerous amounts of boredom.`;
    }
  
    if (state.needs.sleep) {
      return `${name} is blinking one eye at a time.`;
    }
  
    if (state.stats.happiness >= 75 && state.stats.hunger <= 35) {
      return `${name} is thriving in its tiny rectangle.`;
    }
  
    const neutralMessages = [
      `${name} is vibing quietly.`,
      `${name} is contemplating browser tabs.`,
      `${name} seems okay, but suspiciously quiet.`,
      `${name} is waiting for something interesting to happen.`,
      `${name} accepts your existence.`
    ];
  
    return state.message || neutralMessages[Math.floor(Math.random() * neutralMessages.length)];
  }

  function getDisplay(state, now = nowWithOffset(state), lookDirection = "center") {
    stageLabel:
      state.stage === STAGES.ADULT
        ? getAdultAgeLabel(state, now)
        : state.stage.charAt(0).toUpperCase() + state.stage.slice(1),
      history: [...state.history],
      soundEnabled: state.soundEnabled,
  }

    return {
      name: state.name,
      stage: state.stage,
      stageLabel: state.stage.charAt(0).toUpperCase() + state.stage.slice(1),
      statusText: getStatusText(state),
      timerText: getTimerText(state, now),
      nextNeedText: getNextNeedText(state, now),
      sprite:
        state.stage === STAGES.EGG
          ? makeEggSprite()
          : state.stage === STAGES.DEAD
            ? makeTombstoneSprite(state.name)
            : makeSprite(getFace(state)),
      activeNeeds: getActiveNeeds(state),
      badgeText: getBadgeText(state, now),
      isSleeping: state.isSleeping,
      isDead: state.stage === STAGES.DEAD,
      stats: { ...state.stats }
    };
  }

  global.TomogachiGame = {
    STORAGE_KEY,
    STAGES,
    CONFIG,
    createDefaultState,
    sanitizeState,
    nowWithOffset,
    tick,
    petEgg,
    feed,
    wakeUp,
    finishPlay,
    clean,
    sleep,
    skipTestTime,
    getDisplay,
    setName,
    formatDuration
  };
})(globalThis);
