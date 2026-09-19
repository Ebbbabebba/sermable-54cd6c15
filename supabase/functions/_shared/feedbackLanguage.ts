/**
 * Shared helpers so every AI feedback function answers in the user's language.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  sv: "Swedish (svenska)",
  de: "German (Deutsch)",
  fr: "French (français)",
  es: "Spanish (español)",
  it: "Italian (italiano)",
  pt: "Portuguese (português)",
};

/** Normalise codes like "sv-SE" / "SV" to a supported short code. */
export const normalizeLanguageCode = (code?: string | null): string => {
  if (!code) return "en";
  const short = String(code).toLowerCase().split(/[-_]/)[0];
  return LANGUAGE_NAMES[short] ? short : "en";
};

export const languageName = (code?: string | null): string =>
  LANGUAGE_NAMES[normalizeLanguageCode(code)];

/** A hard instruction to append to any system prompt. */
export const languageInstruction = (code?: string | null): string =>
  `\n\nLANGUAGE (MANDATORY): Write ALL user-facing feedback text in ${languageName(
    code,
  )}. This applies to every string you return, including values inside JSON fields. Do not answer in English unless the requested language is English. Keep quoted words from the speech in their original language.`;

type FallbackKey =
  | "outstanding"
  | "great"
  | "good"
  | "keep"
  | "focusMemorizing"
  | "reviewWords"
  | "steadyPace"
  | "nextStep"
  | "defaultSummary"
  | "defaultAdvice"
  | "defaultNextStep"
  | "promptedSections";

const FALLBACKS: Record<string, Record<FallbackKey, string>> = {
  en: {
    outstanding: "Outstanding! You delivered the speech almost perfectly!",
    great: "Great job! You remembered most of the speech with only minor struggles.",
    good: "Good effort! Some sections need more practice.",
    keep: "Keep practicing! Focus on the sections where you needed help.",
    focusMemorizing: "Focus on memorizing:",
    reviewWords: "Review these words:",
    steadyPace: "Work on maintaining a steady pace without pauses.",
    nextStep: "Practice again, aiming for a smooth delivery without pauses.",
    defaultSummary: "Good effort on your presentation!",
    defaultAdvice: "Continue practicing to improve fluency.",
    defaultNextStep: "Practice again focusing on the missed words.",
    promptedSections: "Practice the sections where you needed prompts.",
  },
  sv: {
    outstanding: "Fantastiskt! Du framförde talet nästan helt perfekt!",
    great: "Bra jobbat! Du kom ihåg det mesta av talet med bara små stopp.",
    good: "Bra försök! Vissa avsnitt behöver mer övning.",
    keep: "Fortsätt öva! Fokusera på avsnitten där du behövde hjälp.",
    focusMemorizing: "Fokusera på att lära dig:",
    reviewWords: "Repetera de här orden:",
    steadyPace: "Jobba på ett jämnt tempo utan pauser.",
    nextStep: "Öva igen och sikta på ett flyt utan pauser.",
    defaultSummary: "Bra insats i ditt framförande!",
    defaultAdvice: "Fortsätt öva för att få bättre flyt.",
    defaultNextStep: "Öva igen med fokus på orden du missade.",
    promptedSections: "Öva på avsnitten där du behövde ledtrådar.",
  },
  de: {
    outstanding: "Hervorragend! Du hast die Rede fast perfekt gehalten!",
    great: "Gut gemacht! Du hast das meiste der Rede mit nur kleinen Hängern erinnert.",
    good: "Guter Versuch! Einige Abschnitte brauchen mehr Übung.",
    keep: "Weiter üben! Konzentriere dich auf die Abschnitte, bei denen du Hilfe brauchtest.",
    focusMemorizing: "Konzentriere dich aufs Merken von:",
    reviewWords: "Wiederhole diese Wörter:",
    steadyPace: "Arbeite an einem gleichmäßigen Tempo ohne Pausen.",
    nextStep: "Übe erneut und ziele auf einen flüssigen Vortrag ohne Pausen.",
    defaultSummary: "Gute Leistung bei deinem Vortrag!",
    defaultAdvice: "Übe weiter, um flüssiger zu werden.",
    defaultNextStep: "Übe erneut mit Fokus auf die vergessenen Wörter.",
    promptedSections: "Übe die Abschnitte, in denen du Hinweise gebraucht hast.",
  },
  fr: {
    outstanding: "Excellent ! Tu as livré le discours presque parfaitement !",
    great: "Beau travail ! Tu as retenu l'essentiel du discours avec peu d'hésitations.",
    good: "Bon effort ! Certaines parties demandent plus de pratique.",
    keep: "Continue à t'entraîner ! Concentre-toi sur les parties où tu as eu besoin d'aide.",
    focusMemorizing: "Concentre-toi sur la mémorisation de :",
    reviewWords: "Revois ces mots :",
    steadyPace: "Travaille un rythme régulier sans pauses.",
    nextStep: "Réessaie en visant une livraison fluide sans pauses.",
    defaultSummary: "Bon effort pour ta présentation !",
    defaultAdvice: "Continue à t'entraîner pour gagner en fluidité.",
    defaultNextStep: "Réessaie en te concentrant sur les mots oubliés.",
    promptedSections: "Travaille les parties où tu as eu besoin d'indices.",
  },
  es: {
    outstanding: "¡Excelente! ¡Pronunciaste el discurso casi a la perfección!",
    great: "¡Buen trabajo! Recordaste casi todo el discurso con pocas dudas.",
    good: "¡Buen intento! Algunas secciones necesitan más práctica.",
    keep: "¡Sigue practicando! Céntrate en las secciones donde necesitaste ayuda.",
    focusMemorizing: "Céntrate en memorizar:",
    reviewWords: "Repasa estas palabras:",
    steadyPace: "Trabaja un ritmo constante sin pausas.",
    nextStep: "Practica de nuevo buscando una entrega fluida sin pausas.",
    defaultSummary: "¡Buen esfuerzo en tu presentación!",
    defaultAdvice: "Sigue practicando para mejorar la fluidez.",
    defaultNextStep: "Practica de nuevo centrándote en las palabras olvidadas.",
    promptedSections: "Practica las secciones donde necesitaste pistas.",
  },
  it: {
    outstanding: "Eccellente! Hai pronunciato il discorso quasi alla perfezione!",
    great: "Ottimo lavoro! Hai ricordato quasi tutto il discorso con poche esitazioni.",
    good: "Buon tentativo! Alcune sezioni richiedono più pratica.",
    keep: "Continua a esercitarti! Concentrati sulle sezioni in cui hai avuto bisogno di aiuto.",
    focusMemorizing: "Concentrati sul memorizzare:",
    reviewWords: "Ripassa queste parole:",
    steadyPace: "Lavora su un ritmo costante senza pause.",
    nextStep: "Riprova puntando a un'esposizione fluida senza pause.",
    defaultSummary: "Bel lavoro con la tua presentazione!",
    defaultAdvice: "Continua a esercitarti per migliorare la fluidità.",
    defaultNextStep: "Riprova concentrandoti sulle parole dimenticate.",
    promptedSections: "Esercitati sulle sezioni in cui hai avuto bisogno di suggerimenti.",
  },
  pt: {
    outstanding: "Excelente! Apresentaste o discurso quase na perfeição!",
    great: "Bom trabalho! Lembraste-te de quase todo o discurso com poucas hesitações.",
    good: "Boa tentativa! Algumas secções precisam de mais prática.",
    keep: "Continua a praticar! Foca-te nas secções onde precisaste de ajuda.",
    focusMemorizing: "Foca-te em memorizar:",
    reviewWords: "Revê estas palavras:",
    steadyPace: "Trabalha um ritmo constante sem pausas.",
    nextStep: "Pratica outra vez, procurando uma apresentação fluida sem pausas.",
    defaultSummary: "Bom esforço na tua apresentação!",
    defaultAdvice: "Continua a praticar para melhorar a fluidez.",
    defaultNextStep: "Pratica outra vez focando-te nas palavras esquecidas.",
    promptedSections: "Pratica as secções onde precisaste de pistas.",
  },
};

export const fallbackText = (code: string | null | undefined, key: FallbackKey): string =>
  FALLBACKS[normalizeLanguageCode(code)][key];
