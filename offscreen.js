function playNotificationSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audio = new AudioContextClass();

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(880, audio.currentTime);

  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.05, audio.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);

  oscillator.connect(gain);
  gain.connect(audio.destination);

  oscillator.start(audio.currentTime);
  oscillator.stop(audio.currentTime + 0.2);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "playNotificationSound") {
    playNotificationSound();
  }
});
