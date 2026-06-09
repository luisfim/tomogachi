const DEFAULT_PET = {
  hunger: 50,
  happiness: 50,
  energy: 50,
  lastUpdated: Date.now()
};

const petElement = document.getElementById("pet");
const statusElement = document.getElementById("status");

const hungerBar = document.getElementById("hunger");
const happinessBar = document.getElementById("happiness");
const energyBar = document.getElementById("energy");

const feedButton = document.getElementById("feedButton");
const playButton = document.getElementById("playButton");
const sleepButton = document.getElementById("sleepButton");
const resetButton = document.getElementById("resetButton");

let pet = { ...DEFAULT_PET };

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function applyTimeDecay(petData) {
  const now = Date.now();
  const minutesPassed = Math.floor((now - petData.lastUpdated) / 60000);

  if (minutesPassed <= 0) {
    return petData;
  }

  return {
    hunger: clamp(petData.hunger + minutesPassed * 2),
    happiness: clamp(petData.happiness - minutesPassed * 1),
    energy: clamp(petData.energy - minutesPassed * 1),
    lastUpdated: now
  };
}

function getMood() {
  if (pet.hunger >= 90) {
    return {
      face: "=T.T=",⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
      status: "Your pet is starving."
    };
  }

  if (pet.energy <= 10) {
    return {
      face: "=-.-=",
      status: "Your pet is exhausted."
    };
  }

  if (pet.happiness <= 10) {
    return {
      face: "=._.=",
      status: "Your pet is sad."
    };
  }

  if (pet.hunger <= 30 && pet.happiness >= 70 && pet.energy >= 40) {
    return {
      face: "=^.^=",
      status: "Your pet is happy."
    };
  }

  return {
    face: "=o.o=",
    status: "Your pet is okay."
  };
}

function render() {
  hungerBar.value = pet.hunger;
  happinessBar.value = pet.happiness;
  energyBar.value = pet.energy;

  const mood = getMood();
  petElement.textContent = mood.face;
  statusElement.textContent = mood.status;
}

function savePet() {
  chrome.storage.local.set({ pet });
}

function updatePet(changes) {
  pet = {
    ...pet,
    ...changes,
    lastUpdated: Date.now()
  };

  savePet();
  render();
}

function feedPet() {
  updatePet({
    hunger: clamp(pet.hunger - 20),
    happiness: clamp(pet.happiness + 5)
  });
}

function playWithPet() {
  updatePet({
    happiness: clamp(pet.happiness + 20),
    energy: clamp(pet.energy - 15),
    hunger: clamp(pet.hunger + 10)
  });
}

function letPetSleep() {
  updatePet({
    energy: clamp(pet.energy + 25),
    hunger: clamp(pet.hunger + 10)
  });
}

function resetPet() {
  pet = { ...DEFAULT_PET, lastUpdated: Date.now() };
  savePet();
  render();
}

function loadPet() {
  chrome.storage.local.get(["pet"], (result) => {
    pet = result.pet || { ...DEFAULT_PET };

    pet = applyTimeDecay(pet);
    savePet();
    render();
  });
}

feedButton.addEventListener("click", feedPet);
playButton.addEventListener("click", playWithPet);
sleepButton.addEventListener("click", letPetSleep);
resetButton.addEventListener("click", resetPet);

loadPet();
