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

  function startSleep(state, now, minutes = 10 + Math.random() * 5) {
    state.isSleeping = true;
    state.sleepEndsAt = now + minutes * MINUTE;
    state.needs.sleep = null;
    state.nextNeedAt.sleep = null;
    state.message = "Your Tomogachi is sleeping.";
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
        state.stats.energy = 100;
        state.message = "Your Tomogachi woke up.";
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

  function petEgg(state, now = nowWithOffset(state)) {
    state = tick(state, now);

    if (state.stage !== STAGES.EGG) return state;

    state.eggHatchAt = Math.max(now + 10 * SECOND, state.eggHatchAt - CONFIG.petEggBonusMs);
    state.message = "The egg moved. Hatching got faster.";

    return tick(state, now);
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
      state.message = "Tomogachi loved the fries, but it was not very healthy.";
    } else {
      state.stats.hunger = clamp(state.stats.hunger - 25);
      state.health = clamp(state.health + 5);
      state.unhealthyDebt = clamp(state.unhealthyDebt - 15);
      state.message = "Tomogachi ate salad and feels healthier.";
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
    state.message = "Tomogachi had fun playing Pong.";

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
    state.message = "Tomogachi is clean now.";

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
    if (state.stage === STAGES.DEAD) return "Your Tomogachi has departed.";
    if (state.stage === STAGES.EGG) return state.message || "The egg is waiting.";
    if (state.isSleeping) return "Your Tomogachi is sleeping.";
    if (state.health <= 25) return "Your Tomogachi is sick.";

    return state.message || "Your Tomogachi is okay.";
  }

  function getDisplay(state, now = nowWithOffset(state)) {
    state = sanitizeState(state, now);

    return {
      name: state.name,
      stage: state.stage,
      stageLabel: state.stage.charAt(0).toUpperCase() + state.stage.slice(1),
      statusText: getStatusText(state),
      timerText: getTimerText(state, now),
      nextNeedText: getNextNeedText(state, now),
      sprite: makeSprite(getFace(state)),
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
    finishPlay,
    clean,
    sleep,
    skipTestTime,
    getDisplay,
    formatDuration
  };
})(globalThis);
