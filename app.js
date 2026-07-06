const LESSONS = [
  {
    title: "Sons simples",
    instruction: "Lis les syllabes à voix haute.",
    prompt: "ma - mi - mo - mu",
  },
  {
    title: "Sons combinés",
    instruction: "Lis lentement ces syllabes.",
    prompt: "la - le - li - lo",
  },
  {
    title: "Mots courts",
    instruction: "Lis les mots.",
    prompt: "maman - lulu - moto",
  },
  {
    title: "Petite phrase",
    instruction: "Lis la phrase complète.",
    prompt: "Lili a lu le mot.",
  },
  {
    title: "Compréhension",
    instruction: "Lis puis réponds : qui lit ?",
    prompt: "Milo lit la lune.",
  },
];

const STORAGE_KEY = "cpLectureProgressV1";
const SPEECH_RATE = 0.95;
// 75% des mots (dans l'ordre) doivent correspondre pour valider la prononciation.
const MATCH_THRESHOLD = 0.75;

const state = {
  studentName: "",
  lessonIndex: 0,
  completedLessons: {},
  lastRecognition: "",
};

const el = {
  studentName: document.getElementById("studentName"),
  saveNameBtn: document.getElementById("saveNameBtn"),
  welcomeMessage: document.getElementById("welcomeMessage"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  exerciseTitle: document.getElementById("exerciseTitle"),
  exerciseInstruction: document.getElementById("exerciseInstruction"),
  exercisePrompt: document.getElementById("exercisePrompt"),
  readInstructionBtn: document.getElementById("readInstructionBtn"),
  readPromptBtn: document.getElementById("readPromptBtn"),
  listenBtn: document.getElementById("listenBtn"),
  validateBtn: document.getElementById("validateBtn"),
  recognitionText: document.getElementById("recognitionText"),
  feedbackText: document.getElementById("feedbackText"),
  nextExerciseBtn: document.getElementById("nextExerciseBtn"),
  resetProgressBtn: document.getElementById("resetProgressBtn"),
};

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state.studentName = parsed.studentName || "";
    state.lessonIndex = Number.isInteger(parsed.lessonIndex) ? clampLessonIndex(parsed.lessonIndex) : 0;
    state.completedLessons = parsed.completedLessons || {};
  } catch (_e) {
    // ignore corrupted storage
  }
}

function clampLessonIndex(index) {
  return Math.min(Math.max(0, index), LESSONS.length - 1);
}

/**
 * Normalise le texte pour comparer la lecture orale :
 * suppression des accents, ponctuation et espaces multiples.
 */
function sanitize(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function currentLesson() {
  return LESSONS[state.lessonIndex] || LESSONS[0];
}

function completionPercent() {
  const total = LESSONS.length;
  const done = Object.values(state.completedLessons).filter(Boolean).length;
  return Math.round((done / total) * 100);
}

function renderStudent() {
  el.studentName.value = state.studentName;
  el.welcomeMessage.textContent = state.studentName
    ? `Bravo ${state.studentName} ! Continue ta lecture.`
    : "Entre ton prénom pour démarrer.";
}

function renderProgress() {
  const value = completionPercent();
  el.progressBar.value = value;
  el.progressText.textContent = `${value}%`;
}

function renderLesson() {
  const lesson = currentLesson();
  el.exerciseTitle.textContent = `${state.lessonIndex + 1}. ${lesson.title}`;
  el.exerciseInstruction.textContent = lesson.instruction;
  el.exercisePrompt.textContent = lesson.prompt;
  el.recognitionText.textContent = "";
  el.feedbackText.textContent = "";
  el.feedbackText.className = "";
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    el.feedbackText.textContent = "Lecture vocale non disponible sur cet appareil.";
    el.feedbackText.className = "warn";
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = SPEECH_RATE;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function startRecognition() {
  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!SpeechRecognition) {
    el.feedbackText.textContent =
      "Reconnaissance vocale indisponible. Utilise le bouton Valider après lecture avec un adulte.";
    el.feedbackText.className = "warn";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  el.recognitionText.textContent = "Écoute en cours...";

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    state.lastRecognition = text;
    el.recognitionText.textContent = `Tu as dit : ${text}`;
    saveState();
  };

  recognition.onerror = () => {
    el.recognitionText.textContent = "Je n'ai pas bien entendu. Réessaie.";
  };

  recognition.start();
}

function validateReading() {
  const SpeechRecognition = getSpeechRecognitionConstructor();

  if (!state.lastRecognition) {
    if (!SpeechRecognition) {
      const approved = window.confirm(
        "Reconnaissance vocale indisponible. Valider cet exercice avec un adulte ?",
      );
      if (!approved) return;

      state.completedLessons[state.lessonIndex] = true;
      saveState();
      renderProgress();
      el.feedbackText.textContent = "Exercice validé avec un adulte.";
      el.feedbackText.className = "ok";
      return;
    }

    el.feedbackText.textContent =
      "Clique d'abord sur « Écouter ma prononciation », puis valide ta lecture.";
    el.feedbackText.className = "warn";
    return;
  }

  const target = sanitize(currentLesson().prompt);
  const said = sanitize(state.lastRecognition);
  const success = isReadingValid(target, said, MATCH_THRESHOLD);

  if (success) {
    state.completedLessons[state.lessonIndex] = true;
    saveState();
    renderProgress();
    el.feedbackText.textContent = "Super prononciation ! Exercice validé 🎉";
    el.feedbackText.className = "ok";
    return;
  }

  el.feedbackText.textContent =
    "Essaie encore : écoute l'énoncé puis relis lentement. Tu peux valider avec un adulte si besoin.";
  el.feedbackText.className = "warn";
}

function isReadingValid(target, said, threshold) {
  const targetWords = target.split(" ").filter(Boolean);
  const saidWords = said.split(" ").filter(Boolean);
  const matchedWords = orderedMatchedWords(targetWords, saidWords);
  const matchRatio = targetWords.length ? matchedWords / targetWords.length : 0;
  return said && (target === said || matchRatio >= threshold);
}

function orderedMatchedWords(targetWords, saidWords) {
  let targetIndex = 0;

  for (let i = 0; i < saidWords.length && targetIndex < targetWords.length; i += 1) {
    if (saidWords[i] === targetWords[targetIndex]) {
      targetIndex += 1;
    }
  }

  return targetIndex;
}

function nextLesson() {
  if (state.lessonIndex >= LESSONS.length - 1) {
    el.feedbackText.textContent = "Bravo ! Tu as terminé tous les exercices 👏";
    el.feedbackText.className = "ok";
    return;
  }

  state.lessonIndex += 1;
  state.lastRecognition = "";
  saveState();
  renderLesson();
}

function resetProgress() {
  state.lessonIndex = 0;
  state.completedLessons = {};
  state.lastRecognition = "";
  saveState();
  renderLesson();
  renderProgress();
}

function bindEvents() {
  el.saveNameBtn.addEventListener("click", () => {
    state.studentName = el.studentName.value.trim();
    saveState();
    renderStudent();
  });

  el.readInstructionBtn.addEventListener("click", () => {
    speak(currentLesson().instruction);
  });

  el.readPromptBtn.addEventListener("click", () => {
    speak(currentLesson().prompt);
  });

  el.listenBtn.addEventListener("click", startRecognition);
  el.validateBtn.addEventListener("click", validateReading);
  el.nextExerciseBtn.addEventListener("click", nextLesson);
  el.resetProgressBtn.addEventListener("click", resetProgress);
}

function init() {
  loadState();
  bindEvents();
  renderStudent();
  renderLesson();
  renderProgress();
}

init();
