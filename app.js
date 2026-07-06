const LESSONS = [
  {
    title: "Les syllabes avec M",
    instruction: "Écoute puis lis chaque syllabe lentement.",
    prompt: "ma - mi - mo - mu",
    course: {
      goal: "Associer la consonne m avec les voyelles a, i, o et u.",
      rule: "La lettre m chante comme dans maman. On colle m avec une voyelle pour former une syllabe.",
      examples: ["ma comme maman", "mi comme midi", "mo comme moto", "mu comme mur"],
      tip: "Pose ton doigt sous chaque bulle et fais une petite pause entre deux syllabes.",
    },
  },
  {
    title: "Les syllabes avec L",
    instruction: "Lis ces syllabes en gardant le son llll au début.",
    prompt: "la - le - li - lo",
    course: {
      goal: "Reconnaître le son l devant plusieurs voyelles.",
      rule: "La lettre l glisse doucement. Quand elle rencontre une voyelle, elle fabrique la, le, li ou lo.",
      examples: ["la comme lapin", "le comme renard le matin", "li comme lit", "lo comme loto"],
      tip: "Souris un peu pour li : cela aide à bien entendre le i.",
    },
  },
  {
    title: "Je lis des mots courts",
    instruction: "Lis les mots sans te presser.",
    prompt: "maman - lulu - moto",
    course: {
      goal: "Assembler plusieurs syllabes pour lire un mot.",
      rule: "Un mot peut être construit avec deux petites syllabes : ma + man, lu + lu, mo + to.",
      examples: ["ma-man", "lu-lu", "mo-to"],
      tip: "Coupe le mot en petits morceaux, puis recolle-les dans ta voix.",
    },
  },
  {
    title: "Je lis une petite phrase",
    instruction: "Lis la phrase complète avec une voix claire.",
    prompt: "Lili a lu le mot.",
    course: {
      goal: "Lire une phrase courte et repérer les espaces entre les mots.",
      rule: "Une phrase commence par une majuscule et se termine par un point.",
      examples: ["Lili", "a", "lu", "le mot"],
      tip: "Respire au début, puis lis mot après mot jusqu’au point.",
    },
  },
  {
    title: "Je comprends ce que je lis",
    instruction: "Lis puis réponds dans ta tête : qui lit ?",
    prompt: "Milo lit la lune.",
    course: {
      goal: "Lire pour comprendre une information simple.",
      rule: "Quand on lit une phrase, on cherche qui fait l’action et ce qui se passe.",
      examples: ["Qui lit ? Milo", "Que regarde-t-on ? la lune"],
      tip: "Après la lecture, raconte la phrase avec tes mots.",
    },
  },
];

const STORAGE_KEY = "cpLectureProgressV2";
const LEGACY_STORAGE_KEY = "cpLectureProgressV1";
const SPEECH_RATE = 0.82;
const MATCH_THRESHOLD = 0.68;

const state = { studentName: "", lessonIndex: 0, completedLessons: {}, lastRecognition: "" };

const el = {
  studentName: document.getElementById("studentName"), saveNameBtn: document.getElementById("saveNameBtn"),
  welcomeMessage: document.getElementById("welcomeMessage"), progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"), courseTitle: document.getElementById("courseTitle"),
  courseGoal: document.getElementById("courseGoal"), courseRule: document.getElementById("courseRule"),
  courseExamples: document.getElementById("courseExamples"), courseTip: document.getElementById("courseTip"),
  exerciseTitle: document.getElementById("exerciseTitle"), exerciseInstruction: document.getElementById("exerciseInstruction"),
  exercisePrompt: document.getElementById("exercisePrompt"), readInstructionBtn: document.getElementById("readInstructionBtn"),
  readPromptBtn: document.getElementById("readPromptBtn"), listenBtn: document.getElementById("listenBtn"),
  validateBtn: document.getElementById("validateBtn"), recognitionText: document.getElementById("recognitionText"),
  feedbackText: document.getElementById("feedbackText"), nextExerciseBtn: document.getElementById("nextExerciseBtn"),
  resetProgressBtn: document.getElementById("resetProgressBtn"),
};

function getSpeechRecognitionConstructor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
function clampLessonIndex(index) { return Math.min(Math.max(0, index), LESSONS.length - 1); }
function currentLesson() { return LESSONS[state.lessonIndex] || LESSONS[0]; }

function saveState() {
  try {
    const { studentName, lessonIndex, completedLessons } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ studentName, lessonIndex, completedLessons }));
  } catch (_e) {
    // Storage can be disabled in private or restricted browser contexts.
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.studentName = parsed.studentName || "";
    state.lessonIndex = Number.isInteger(parsed.lessonIndex) ? clampLessonIndex(parsed.lessonIndex) : 0;
    state.completedLessons = parsed.completedLessons || {};

    if (!localStorage.getItem(STORAGE_KEY)) saveState();
  } catch (_e) {
    // Ignore corrupted or disabled storage so the app can still run.
  }
}

function sanitize(str) {
  return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function promptTokens(text) { return sanitize(text).split(" ").filter(Boolean); }

function phoneticToken(token) {
  return token.replace(/ou/g, "u").replace(/au|eau/g, "o").replace(/an|am/g, "a").replace(/en|em/g, "a");
}

function tokenMatches(expected, heard) {
  const a = phoneticToken(expected);
  const b = phoneticToken(heard);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 3) return false;
  return levenshteinDistance(a, b) <= 1;
}

function levenshteinDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }
  return rows[a.length][b.length];
}

function completionPercent() {
  return Math.round((Object.values(state.completedLessons).filter(Boolean).length / LESSONS.length) * 100);
}

function renderStudent() {
  el.studentName.value = state.studentName;
  el.welcomeMessage.textContent = state.studentName ? `Bravo ${state.studentName}, Nino t’attend pour lire !` : "Entre ton prénom pour démarrer l’aventure.";
}

function renderProgress() {
  const value = completionPercent();
  el.progressBar.value = value;
  el.progressText.textContent = `${value}%`;
}

function renderCourse(lesson) {
  const course = lesson.course || {};
  el.courseTitle.textContent = lesson.title || "J’apprends";
  el.courseGoal.textContent = course.goal || "";
  el.courseRule.textContent = course.rule || "";
  el.courseTip.textContent = course.tip || "";
  el.courseExamples.innerHTML = "";
  (course.examples || []).forEach((example) => {
    const li = document.createElement("li");
    li.textContent = example;
    el.courseExamples.appendChild(li);
  });
}

function displayTokens(text) {
  if (!text) return [];
  return String(text).split(/\s+-\s+|\s+/).filter(Boolean);
}

function renderPrompt(text) {
  el.exercisePrompt.innerHTML = "";
  displayTokens(text).forEach((token) => {
    const span = document.createElement("span");
    span.className = "prompt-token";
    span.textContent = token;
    el.exercisePrompt.appendChild(span);
  });
}

function renderLesson() {
  const lesson = currentLesson();
  el.exerciseTitle.textContent = `${state.lessonIndex + 1}. ${lesson.title}`;
  el.exerciseInstruction.textContent = lesson.instruction;
  renderPrompt(lesson.prompt);
  renderCourse(lesson);
  state.lastRecognition = "";
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
  const utterance = new SpeechSynthesisUtterance(text.replace(/ - /g, ", "));
  utterance.lang = "fr-FR";
  utterance.rate = SPEECH_RATE;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function startRecognition() {
  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!SpeechRecognition) {
    el.feedbackText.textContent = "Micro indisponible ici. Lis avec un adulte puis utilise Valider.";
    el.feedbackText.className = "warn";
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 5;
  state.lastRecognition = "";
  el.recognitionText.textContent = "Nino écoute... lis lentement chaque bulle.";
  let hasError = false;

  recognition.onresult = (event) => {
    const transcript = transcriptFromResults(event.results, currentLesson().prompt, false);
    if (transcript) el.recognitionText.textContent = `Nino entend peut-être : ${transcript}`;

    const finalTranscript = transcriptFromResults(event.results, currentLesson().prompt, true);
    if (finalTranscript) {
      state.lastRecognition = finalTranscript;
      el.recognitionText.textContent = `Nino a entendu : ${state.lastRecognition}`;
    }
  };
  recognition.onerror = (event) => {
    hasError = true;
    el.recognitionText.textContent = event.error === "not-allowed"
      ? "Accès au micro refusé. Active-le dans les paramètres du navigateur."
      : "Nino n’a pas bien entendu. Rapproche-toi et réessaie.";
  };
  recognition.onend = () => {
    if (!state.lastRecognition && !hasError) {
      el.recognitionText.textContent = "Aucun son capté. Essaie encore ou lis avec un adulte.";
    }
  };
  recognition.start();
}

function transcriptFromResults(results, targetPrompt, finalOnly) {
  return Array.from(results)
    .filter((result) => !finalOnly || result.isFinal)
    .map((result, index) => chooseBestTranscript(
      Array.from(result).map((item) => item.transcript),
      targetPrompt,
      index,
    ))
    .filter(Boolean)
    .join(" ")
    .trim();
}

function chooseBestTranscript(transcripts, targetPrompt, segmentIndex = 0) {
  const target = promptTokens(targetPrompt);
  const segmentTarget = target.slice(segmentIndex, segmentIndex + 1);
  const scoringTarget = segmentTarget.length ? segmentTarget : target;
  return transcripts.reduce((best, transcript) => {
    const score = readingScore(scoringTarget, promptTokens(transcript));
    return score > best.score ? { text: transcript, score } : best;
  }, { text: transcripts[0] || "", score: -1 }).text;
}

function validateReading() {
  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!state.lastRecognition) {
    if (!SpeechRecognition && window.confirm("Valider cet exercice après lecture avec un adulte ?")) {
      completeLesson("Exercice validé avec un adulte. Bravo !");
      return;
    }
    el.feedbackText.textContent = "Clique d’abord sur « Je lis à Nino », puis valide ta lecture.";
    el.feedbackText.className = "warn";
    return;
  }
  const score = readingScore(promptTokens(currentLesson().prompt), promptTokens(state.lastRecognition));
  if (score >= MATCH_THRESHOLD) {
    completeLesson(`Super ! Nino a reconnu ta lecture (${Math.round(score * 100)}%). 🎉`);
    return;
  }
  el.feedbackText.textContent = "Essaie encore : lis une bulle à la fois, avec une petite pause entre les syllabes.";
  el.feedbackText.className = "warn";
}

function readingScore(targetWords, saidWords) {
  if (!targetWords.length || !saidWords.length) return 0;
  let matched = 0;
  let saidIndex = 0;

  targetWords.forEach((target) => {
    while (saidIndex < saidWords.length) {
      const heard = saidWords[saidIndex];
      saidIndex += 1;
      if (tokenMatches(target, heard)) {
        matched += 1;
        break;
      }
    }
  });

  return matched / targetWords.length;
}

function completeLesson(message) {
  state.completedLessons[state.lessonIndex] = true;
  saveState();
  renderProgress();
  el.feedbackText.textContent = message;
  el.feedbackText.className = "ok";
}

function nextLesson() {
  if (state.lessonIndex >= LESSONS.length - 1) {
    el.feedbackText.textContent = "Bravo ! Toutes les missions du jardin sont terminées 👏";
    el.feedbackText.className = "ok";
    return;
  }
  state.lessonIndex += 1;
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
  el.saveNameBtn.addEventListener("click", () => { state.studentName = el.studentName.value.trim(); saveState(); renderStudent(); });
  el.readInstructionBtn.addEventListener("click", () => speak(currentLesson().instruction));
  el.readPromptBtn.addEventListener("click", () => speak(currentLesson().prompt));
  el.listenBtn.addEventListener("click", startRecognition);
  el.validateBtn.addEventListener("click", validateReading);
  el.nextExerciseBtn.addEventListener("click", nextLesson);
  el.resetProgressBtn.addEventListener("click", resetProgress);
}

function init() { loadState(); bindEvents(); renderStudent(); renderLesson(); renderProgress(); }
init();
