const STORAGE_KEY = "cpLectureAlphabetV1";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

const WORD_BANK = {
  a: { word: "avion", emoji: "✈️", cursive: "𝒶𝓋𝒾𝑜𝓃", instruction: "Ouvre grand la bouche et fais vibrer la voix, comme quand tu as peur : aaaa !", words: ["un chat", "de la farine", "un lac", "des haricots", "ma valise", "la classe", "papa", "une baleine", "Omar"], soundItems: [["ballon", "🎈"], ["cartable", "🎒"], ["crocodile", "🐊"], ["perroquet", "🦜"], ["trousse", "✏️"], ["crabe", "🦀"], ["ananas", "🍍"], ["avion", "✈️"]] },
  b: { word: "ballon", emoji: "🎈" }, c: { word: "cartable", emoji: "🎒" }, d: { word: "dinosaure", emoji: "🦕" }, e: { word: "éléphant", emoji: "🐘" }, f: { word: "fusée", emoji: "🚀" }, g: { word: "girafe", emoji: "🦒" }, h: { word: "hibou", emoji: "🦉" }, i: { word: "igloo", emoji: "🧊" }, j: { word: "jardin", emoji: "🌷" }, k: { word: "koala", emoji: "🐨" }, l: { word: "lapin", emoji: "🐰" }, m: { word: "moto", emoji: "🏍️" }, n: { word: "nuage", emoji: "☁️" }, o: { word: "orange", emoji: "🍊" }, p: { word: "pomme", emoji: "🍎" }, q: { word: "quille", emoji: "🎳" }, r: { word: "robot", emoji: "🤖" }, s: { word: "soleil", emoji: "☀️" }, t: { word: "tortue", emoji: "🐢" }, u: { word: "usine", emoji: "🏭" }, v: { word: "valise", emoji: "🧳" }, w: { word: "wagon", emoji: "🚃" }, x: { word: "xylophone", emoji: "🎼" }, y: { word: "yoyo", emoji: "🪀" }, z: { word: "zèbre", emoji: "🦓" },
};

const DECOY_LETTERS = ["e", "i", "o", "u", "m", "n", "r", "s", "t", "l", "p", "d", "b", "A", "E", "M", "R"];
const DEFAULT_WORDS = ["un ami", "la lune", "le vélo", "une tomate", "mon cartable", "une souris", "papa lit", "la maison"];
const DEFAULT_SOUNDS = [["ballon", "🎈"], ["vélo", "🚲"], ["mouton", "🐑"], ["tortue", "🐢"], ["soleil", "☀️"], ["robot", "🤖"], ["maison", "🏠"], ["lapin", "🐰"]];

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
    soundItems: (base.soundItems || DEFAULT_SOUNDS).map(([word, emoji]) => ({ word, emoji })),
    letterHunt: huntValues.map((value, index) => ({ value, key: `${letter}-${value}-${index}` })),
  };
}

const { createApp } = Vue;

createApp({
  data() {
    return { studentName: "", pageIndex: 0, completed: {}, selectedLetters: [], selectedSounds: [] };
  },
  computed: {
    letters() { return ALPHABET.map(buildLetter); },
    isOnboarding() { return this.pageIndex === 0; },
    currentLetter() { return this.letters[this.pageIndex - 1] || this.letters[0]; },
    displayName() { return this.studentName || "explorateur"; },
    completedCount() { return Object.values(this.completed).filter(Boolean).length; },
    progressPercent() { return Math.round((this.completedCount / this.letters.length) * 100); },
  },
  mounted() { this.loadState(); },
  watch: { pageIndex() { this.selectedLetters = []; this.selectedSounds = []; this.saveState(); } },
  methods: {
    startJourney() {
      if (!this.studentName) { window.alert("Entre ton prénom pour commencer."); return; }
      this.pageIndex = 1;
      this.saveState();
    },
    previousPage() { if (this.pageIndex > 1) this.pageIndex -= 1; },
    nextPage() { this.pageIndex = this.pageIndex >= this.letters.length ? 1 : this.pageIndex + 1; },
    markDone() { this.completed[this.currentLetter.lower] = true; this.saveState(); this.nextPage(); },
    toggleToken(item) { const id = item.key; this.selectedLetters = this.selectedLetters.includes(id) ? this.selectedLetters.filter((x) => x !== id) : [...this.selectedLetters, id]; },
    tokenClass(item, target) { return { picked: this.selectedLetters.includes(item.key), good: this.normalize(item.value) === target }; },
    toggleSound(word) { this.selectedSounds = this.selectedSounds.includes(word) ? this.selectedSounds.filter((x) => x !== word) : [...this.selectedSounds, word]; },
    splitWord(word) { return Array.from(word); },
    normalize(value) { return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); },
    saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ studentName: this.studentName, pageIndex: this.pageIndex, completed: this.completed }));
      } catch (_e) {
        // Storage can be disabled in private or restricted browser contexts.
      }
    },
    loadState() { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); this.studentName = parsed.studentName || ""; this.pageIndex = Number.isInteger(parsed.pageIndex) ? parsed.pageIndex : 0; this.completed = parsed.completed || {}; } catch (_e) { this.pageIndex = 0; } },
  },
}).mount("#app");
