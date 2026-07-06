const STORAGE_KEY = "cpLectureAlphabetV1";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

const WORD_BANK = {
  a: { word: "avion", emoji: "✈️", cursive: "𝒶𝓋𝒾𝑜𝓃", instruction: "Ouvre grand la bouche et fais vibrer la voix, comme quand tu as peur : aaaa !", words: ["un chat", "de la farine", "un lac", "des haricots", "ma valise", "la classe", "papa", "une baleine", "Omar"], soundItems: [["ballon", "🎈"], ["cartable", "🎒"], ["crocodile", "🐊"], ["perroquet", "🦜"], ["trousse", "✏️"], ["crabe", "🦀"], ["ananas", "🍍"], ["avion", "✈️"]] },
  b: { word: "ballon", emoji: "🎈" }, c: { word: "cartable", emoji: "🎒" }, d: { word: "dinosaure", emoji: "🦕" }, e: { word: "éléphant", emoji: "🐘" }, f: { word: "fusée", emoji: "🚀" }, g: { word: "girafe", emoji: "🦒" }, h: { word: "hibou", emoji: "🦉" }, i: { word: "igloo", emoji: "🧊" }, j: { word: "jardin", emoji: "🌷" }, k: { word: "koala", emoji: "🐨" }, l: { word: "lapin", emoji: "🐰" }, m: { word: "moto", emoji: "🏍️" }, n: { word: "nuage", emoji: "☁️" }, o: { word: "orange", emoji: "🍊" }, p: { word: "pomme", emoji: "🍎" }, q: { word: "quille", emoji: "🎳" }, r: { word: "robot", emoji: "🤖" }, s: { word: "soleil", emoji: "☀️" }, t: { word: "tortue", emoji: "🐢" }, u: { word: "usine", emoji: "🏭" }, v: { word: "valise", emoji: "🧳" }, w: { word: "wagon", emoji: "🚃" }, x: { word: "xylophone", emoji: "🎼" }, y: { word: "yoyo", emoji: "🪀" }, z: { word: "zèbre", emoji: "🦓" },
};

const DECOY_LETTERS = ["e", "i", "o", "u", "m", "n", "r", "s", "t", "l", "p", "d", "b", "A", "E", "M", "R"];
const DEFAULT_WORDS = ["un ami", "la lune", "le vélo", "une tomate", "mon cartable", "une souris", "papa lit", "la maison"];
const DEFAULT_SOUNDS = [["ballon", "🎈"], ["vélo", "🚲"], ["mouton", "🐑"], ["tortue", "🐢"], ["soleil", "☀️"], ["robot", "🤖"], ["maison", "🏠"], ["lapin", "🐰"]];

function normalizeText(value) { return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

function buildLetter(letter) {
  const base = WORD_BANK[letter] || {};
  const lower = letter;
  const upper = letter.toUpperCase();
  const huntValues = [lower, upper, ...DECOY_LETTERS, lower, upper, "a", "i", "o", lower].slice(0, 24);
  return {
    lower,
    upper,
    sound: `[${lower}]`,
    word: base.word,
    emoji: base.emoji,
    cursive: base.cursive || base.word,
    schoolLower: lower === "a" ? "ɑ" : lower,
    schoolUpper: upper,
    instruction: base.instruction || `Dis le son ${lower} doucement, puis recommence en faisant vibrer ta voix si le son le demande.`,
    speechText: base.instruction || `Écoute et cherche la lettre ${upper}, puis le son ${lower}.`,
    words: base.words || DEFAULT_WORDS.map((word, index) => index % 2 === 0 ? word.replace(/[aeiou]/, lower) : word),
    soundItems: (base.soundItems || DEFAULT_SOUNDS).map(([word, emoji]) => ({ word, emoji, isTarget: normalizeText(word).includes(lower) })),
    letterHunt: huntValues.map((value, index) => ({ value, key: `${letter}-${value}-${index}`, isTarget: normalizeText(value) === lower })),
  };
}

const { createApp } = Vue;

createApp({
  data() {
    return { studentName: "", pageIndex: 0, completed: {}, selectedLetters: [], selectedSounds: [], feedback: {}, pageEffect: "", audioContext: null };
  },
  computed: {
    letters() { return ALPHABET.map(buildLetter); },
    isOnboarding() { return this.pageIndex === 0; },
    currentLetter() { return this.letters[this.pageIndex - 1] || this.letters[0]; },
    displayName() { return this.studentName || "explorateur"; },
    completedCount() { return Object.values(this.completed).filter(Boolean).length; },
    progressPercent() { return Math.round((this.completedCount / this.letters.length) * 100); },
    allLettersFound() { return this.currentLetter.letterHunt.filter((item) => item.isTarget).every((item) => this.selectedLetters.includes(item.key)); },
    allSoundsFound() { return this.currentLetter.soundItems.filter((item) => item.isTarget).every((item) => this.selectedSounds.includes(item.word)); },
    pageReady() { return this.allLettersFound && this.allSoundsFound; },
  },
  mounted() { this.loadState(); this.prepareVoices(); },
  watch: { pageIndex() { this.selectedLetters = []; this.selectedSounds = []; this.feedback = {}; this.animatePage(); this.saveState(); } },
  methods: {
    startJourney() {
      if (!this.studentName) { window.alert("Entre ton prénom pour commencer."); return; }
      this.unlockAudio();
      this.pageIndex = 1;
      this.saveState();
    },
    previousPage() { if (this.pageIndex > 1) this.pageIndex -= 1; },
    nextPage() { this.pageIndex = this.pageIndex >= this.letters.length ? 1 : this.pageIndex + 1; },
    markDone() {
      if (!this.pageReady) { this.playTone(false); this.feedback.page = "Il reste des bonnes réponses à trouver avant de terminer la fiche."; return; }
      this.completed[this.currentLetter.lower] = true;
      this.saveState();
      this.playApplause();
      const pageAtCompletion = this.pageIndex;
      setTimeout(() => { if (this.pageIndex === pageAtCompletion) this.nextPage(); }, 900);
    },
    toggleToken(item) {
      this.unlockAudio();
      const id = item.key;
      if (!this.selectedLetters.includes(id)) this.selectedLetters = [...this.selectedLetters, id];
      this.feedback[id] = item.isTarget ? "correct" : "wrong";
      this.playTone(item.isTarget);
    },
    tokenClass(item) { return { picked: this.selectedLetters.includes(item.key), good: item.isTarget, correct: this.feedback[item.key] === "correct", wrong: this.feedback[item.key] === "wrong" }; },
    toggleSound(item) {
      this.unlockAudio();
      this.speak(item.word);
      if (!this.selectedSounds.includes(item.word)) this.selectedSounds = [...this.selectedSounds, item.word];
      this.feedback[`sound-${item.word}`] = item.isTarget ? "correct" : "wrong";
      this.playTone(item.isTarget);
    },
    soundClass(item) { return { selected: this.selectedSounds.includes(item.word), correct: this.feedback[`sound-${item.word}`] === "correct", wrong: this.feedback[`sound-${item.word}`] === "wrong" }; },
    splitWord(word) { return Array.from(word); },
    normalize(value) { return normalizeText(value); },
    prepareVoices() { if ("speechSynthesis" in window) window.speechSynthesis.getVoices(); },
    speak(text) {
      if (!("speechSynthesis" in window)) { window.alert("La lecture audio n'est pas disponible dans ce navigateur."); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.rate = 0.82;
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("fr")) || null;
      window.speechSynthesis.speak(utterance);
    },
    unlockAudio() {
      if (!this.audioContext) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            this.audioContext = new AudioContextClass();
          }
        } catch (e) {
          console.error("Impossible d'initialiser l'AudioContext :", e);
        }
      }
      if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(e => console.error("Impossible de relancer l'AudioContext :", e));
      }
    },
    playTone(success) {
      this.unlockAudio();
      const ctx = this.audioContext;
      if (!ctx) return;
      const now = ctx.currentTime;
      [success ? 523 : 180, success ? 784 : 120].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = success ? "sine" : "sawtooth";
        gain.gain.setValueAtTime(0.0001, now + index * 0.11);
        gain.gain.exponentialRampToValueAtTime(success ? 0.18 : 0.09, now + index * 0.11 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.11 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + index * 0.11);
        osc.stop(now + index * 0.11 + 0.18);
      });
    },
    playApplause() {
      this.unlockAudio();
      const ctx = this.audioContext;
      if (!ctx) return;
      const now = ctx.currentTime;
      const bufferLength = Math.floor(ctx.sampleRate * 0.08);
      for (let i = 0; i < 18; i += 1) {
        const source = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < data.length; j += 1) {
          data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
        }
        const gain = ctx.createGain();
        gain.gain.value = 0.08;
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(now + i * 0.035);
      }
    },
    animatePage() { this.pageEffect = "page-turn"; setTimeout(() => { this.pageEffect = ""; }, 520); },
    saveState() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ studentName: this.studentName, pageIndex: this.pageIndex, completed: this.completed })); }
      catch (_e) { /* Storage can be disabled in private or restricted browser contexts. */ }
    },
    loadState() { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); this.studentName = parsed.studentName || ""; const page = parsed.pageIndex; this.pageIndex = (Number.isInteger(page) && page >= 0 && page <= this.letters.length) ? page : 0; this.completed = parsed.completed || {}; } catch (_e) { this.pageIndex = 0; } },
  },
}).mount("#app");
