import { db, one, many } from './db.ts';
import { getLessonById, LESSONS_CATALOG, type LessonExercise, type LessonDefinition } from './lessons-catalog.ts';
import { getActiveLLMProvider } from './llm-provider.ts';
import { createHash } from 'node:crypto';

export interface PracticeAttemptResult {
  isCorrect: boolean;
  chosenIndex: number;
  correctIndex: number;
  explanation: string;
  feedback: string;
  misconceptionExplanation?: string;
  nextStepRecommendation: string;
  conceptMastery: {
    concept: string;
    level: 'novice' | 'practicing' | 'proficient' | 'mastered';
    score: number;
    problemsSolved: number;
  };
  lessonProgress: {
    lessonId: string;
    exercisesCompleted: number;
    exercisesTotal: number;
    isLessonCompleted: boolean;
  };
}

export interface GeneratedQuestion {
  id: string;
  skillSlug: string;
  topic: string;
  difficulty: 'introductory' | 'foundational' | 'intermediate' | 'advanced';
  questionType: 'conceptual' | 'code_tracing' | 'debugging' | 'fill_in_the_blank';
  prompt: string;
  codeSnippet?: string;
  language?: string;
  choices: string[];
  correctIndex: number;
  hints: string[];
  explanation: string;
  source: 'vetted' | 'template' | 'gemini_ai';
  fingerprint: string;
}

// In-memory fallback stores for test and dev environments where DB is transient
const memLessonProgress = new Map<string, { exercisesCompleted: number; status: string; completedAt?: string }>();
const memConceptMastery = new Map<string, { score: number; status: 'novice' | 'practicing' | 'proficient' | 'mastered'; solved: number; attempted: number }>();

/**
 * Calculates a duplicate-detection fingerprint for question deduplication.
 */
export function computeQuestionFingerprint(prompt: string, choices: string[]): string {
  const normPrompt = prompt.toLowerCase().replace(/\s+/g, ' ').trim();
  const normChoices = choices.map((c) => c.toLowerCase().replace(/\s+/g, ' ').trim()).sort().join('|');
  return createHash('sha256').update(`${normPrompt}::${normChoices}`).digest('hex').slice(0, 32);
}

/**
 * Validates a generated question schema strictly.
 */
export function validateQuestionSchema(q: any): q is GeneratedQuestion {
  if (!q || typeof q !== 'object') return false;
  if (typeof q.prompt !== 'string' || q.prompt.trim().length < 10) return false;
  if (!Array.isArray(q.choices) || q.choices.length !== 4) return false;
  if (q.choices.some((c: any) => typeof c !== 'string' || c.trim().length === 0)) return false;
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) return false;
  if (typeof q.explanation !== 'string' || q.explanation.trim().length < 10) return false;
  if (!Array.isArray(q.hints) || q.hints.length === 0) return false;
  return true;
}

/**
 * Generates an algorithmic problem from a template with varied inputs.
 */
export function generateTemplatedProblem(concept: string, skillSlug: string): GeneratedQuestion {
  // 1. JavaScript Closures & Lexical Scope Template
  if (skillSlug === 'javascript' || skillSlug === 'modern-javascript' || concept.includes('closure')) {
    const factor = 2 + Math.floor(Math.random() * 3); // 2, 3, 4
    const inputVal = 3 + Math.floor(Math.random() * 4); // 3, 4, 5, 6
    const expected = factor * inputVal;
    const choices = [
      String(expected),
      String(expected + factor),
      String(inputVal * 2),
      'undefined'
    ];
    const correctVal = choices[0];
    choices.sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(correctVal);

    const prompt = 'What will be output to the console when this JavaScript script executes?';
    const codeSnippet = `function makeMultiplier(factor) {\n    return function(number) {\n        return number * factor;\n    };\n}\nconst multiply = makeMultiplier(${factor});\nconsole.log(multiply(${inputVal}));`;
    const fingerprint = computeQuestionFingerprint(prompt + codeSnippet, choices);

    return {
      id: `tmpl-js-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      skillSlug: 'javascript',
      topic: 'closures',
      difficulty: 'foundational',
      questionType: 'code_tracing',
      language: 'javascript',
      prompt,
      codeSnippet,
      choices,
      correctIndex,
      hints: [
        `Identify what value \`factor\` holds when makeMultiplier(${factor}) is called.`,
        `The returned inner function forms a closure over \`factor\`.`,
        `Multiply ${inputVal} by ${factor}.`
      ],
      explanation: `\`multiply\` closes over \`factor = ${factor}\`. When called with \`number = ${inputVal}\`, it evaluates ${inputVal} * ${factor} = ${expected}.`,
      source: 'template',
      fingerprint
    };
  }

  // 2. C Systems & Pointers Template
  if (skillSlug === 'c-systems' || concept.includes('pointer')) {
    const initial = 10 * (1 + Math.floor(Math.random() * 5)); // 10, 20, 30...
    const modified = initial + 25;
    const choices = [
      String(modified),
      String(initial),
      '0',
      'Segmentation Fault'
    ];
    const correctVal = choices[0];
    choices.sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(correctVal);

    const prompt = 'What will be printed when this C code executes?';
    const codeSnippet = `int value = ${initial};\nint *ptr = &value;\n*ptr = ${modified};\nprintf("%d", value);`;
    const fingerprint = computeQuestionFingerprint(prompt + codeSnippet, choices);

    return {
      id: `tmpl-ptr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      skillSlug: 'c-systems',
      topic: 'pointers',
      difficulty: 'foundational',
      questionType: 'code_tracing',
      language: 'c',
      prompt,
      codeSnippet,
      choices,
      correctIndex,
      hints: [
        `ptr holds the memory address of value (&value).`,
        `*ptr dereferences the address and writes ${modified} directly to that cell.`,
        `When value is read in printf, what is inside its memory cell?`
      ],
      explanation: `Dereferencing \`*ptr = ${modified}\` updates the memory location where \`value\` resides. Printing \`value\` outputs ${modified}.`,
      source: 'template',
      fingerprint
    };
  }

  // 3. Problem Solving / Loop Tracing in C
  if (skillSlug === 'problem-solving' || concept.includes('loop')) {
    const start = Math.floor(Math.random() * 3); // 0 or 1 or 2
    const end = start + 4 + Math.floor(Math.random() * 3); // e.g. 5, 6, 7
    const multiplier = 2;
    let expected = 0;
    for (let i = start; i < end; i++) {
      if (i % 2 !== 0) expected += i * multiplier;
    }
    const choices = [
      String(expected),
      String(expected + 2),
      String(Math.max(0, expected - 3)),
      String(expected * 2)
    ];
    // Shuffle choices
    const correctVal = choices[0];
    choices.sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(correctVal);

    const prompt = `What is the value of \`total\` after this loop terminates?`;
    const codeSnippet = `int total = 0;\nfor (int i = ${start}; i < ${end}; i++) {\n    if (i % 2 != 0) {\n        total += i * ${multiplier};\n    }\n}`;
    const fingerprint = computeQuestionFingerprint(prompt + codeSnippet, choices);

    return {
      id: `tmpl-loop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      skillSlug: 'problem-solving',
      topic: 'loop_tracing',
      difficulty: 'foundational',
      questionType: 'code_tracing',
      language: 'c',
      prompt,
      codeSnippet,
      choices,
      correctIndex,
      hints: [
        `Write down the values of i from ${start} up to ${end - 1}.`,
        `Select only the odd numbers where i % 2 != 0.`,
        `Multiply each odd number by ${multiplier} and accumulate.`
      ],
      explanation: `The loop runs for i from ${start} to ${end - 1}. The odd values are identified, multiplied by ${multiplier}, and summed to yield ${expected}.`,
      source: 'template',
      fingerprint
    };
  }

  // Default fallback vetted question
  const fallback = LESSONS_CATALOG[0].exercises[0];
  return {
    id: fallback.id,
    skillSlug,
    topic: 'loop_tracing',
    difficulty: fallback.difficulty,
    questionType: fallback.type,
    language: fallback.language || 'c',
    prompt: fallback.prompt,
    codeSnippet: fallback.codeSnippet,
    choices: fallback.choices,
    correctIndex: fallback.correctIndex,
    hints: fallback.hints,
    explanation: fallback.explanation,
    source: 'vetted',
    fingerprint: computeQuestionFingerprint(fallback.prompt, fallback.choices)
  };
}

export const memDynamicQuestions = new Map<string, GeneratedQuestion>();

/**
 * Persists a generated question to the database or in-memory cache.
 */
export async function persistGeneratedQuestion(q: GeneratedQuestion): Promise<void> {
  memDynamicQuestions.set(q.id, q);
  if (!process.env.DATABASE_URL) return;
  try {
    await db().query(
      `insert into practice_questions (
         id, skill_slug, topic, difficulty, question_type, prompt,
         code_snippet, choices, correct_index, hints, explanation, source, fingerprint
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       on conflict (id) do nothing`,
      [
        q.id,
        q.skillSlug,
        q.topic,
        q.difficulty,
        q.questionType,
        q.prompt,
        q.codeSnippet || null,
        JSON.stringify(q.choices),
        q.correctIndex,
        JSON.stringify(q.hints),
        q.explanation,
        q.source,
        q.fingerprint
      ]
    );
  } catch (err) {
    console.error('Failed to persist practice question', err);
  }
}

/**
 * On-demand question generation using Google Gemini with automatic fallback to validated templates.
 */
export async function generateContinuousPracticeQuestion(
  skillSlug: string,
  topic: string,
  difficulty: 'introductory' | 'foundational' | 'intermediate' | 'advanced' = 'foundational'
): Promise<GeneratedQuestion> {
  const active = getActiveLLMProvider();

  if (active && active.provider && active.providerName === 'gemini') {
    try {
      const prompt = `Generate a single multiple-choice practice question for a student learning ${skillSlug} on the topic "${topic}" at ${difficulty} level.
Respond ONLY with a valid JSON object matching this exact schema:
{
  "prompt": "Question text asking for code output, bug identification, or conceptual understanding",
  "codeSnippet": "optional short code snippet to trace or debug, or omit if pure concept",
  "choices": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "hints": ["Hint 1 (conceptual clue)", "Hint 2 (walkthrough detail)", "Hint 3 (near solution)"],
  "explanation": "Clear educational explanation of why the correct option is right and others are wrong"
}`;

      const raw = await active.provider.generateText(prompt, { tier: 'fast', temperature: 0.3, maxTokens: 800, timeoutMs: 15000 });
      // Clean JSON formatting
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (validateQuestionSchema(parsed)) {
        const fingerprint = computeQuestionFingerprint(parsed.prompt, parsed.choices);
        const q: GeneratedQuestion = {
          id: `gemini-q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          skillSlug,
          topic,
          difficulty,
          questionType: parsed.codeSnippet ? 'code_tracing' : 'conceptual',
          prompt: parsed.prompt,
          codeSnippet: parsed.codeSnippet,
          choices: parsed.choices,
          correctIndex: parsed.correctIndex,
          hints: parsed.hints,
          explanation: parsed.explanation,
          source: 'gemini_ai',
          fingerprint
        };
        await persistGeneratedQuestion(q);
        return q;
      }
    } catch {
      // Graceful fallback to verified templates on rate limit or format failure
    }
  }

  const templated = generateTemplatedProblem(topic, skillSlug);
  await persistGeneratedQuestion(templated);
  return templated;
}

/**
 * Evaluates an exercise submission, updates lesson progress and mastery,
 * and records verified evidence when mastery criteria are satisfied.
 */
export async function submitExerciseAttempt(params: {
  userId: string;
  lessonId: string;
  exerciseId: string;
  chosenIndex: number;
  hintsUsed?: number;
}): Promise<PracticeAttemptResult> {
  const { userId, lessonId, exerciseId, chosenIndex, hintsUsed = 0 } = params;
  const lesson = getLessonById(lessonId) || LESSONS_CATALOG[0];

  let exercise: {
    id: string;
    concept: string;
    prompt: string;
    codeSnippet?: string;
    choices: string[];
    correctIndex: number;
    hints: string[];
    explanation: string;
    misconceptions?: Record<number, string>;
  } | undefined = lesson.exercises.find((e) => e.id === exerciseId);

  if (!exercise) {
    const memQ = memDynamicQuestions.get(exerciseId);
    if (memQ) {
      exercise = {
        id: memQ.id,
        concept: memQ.topic,
        prompt: memQ.prompt,
        codeSnippet: memQ.codeSnippet,
        choices: memQ.choices,
        correctIndex: memQ.correctIndex,
        hints: memQ.hints,
        explanation: memQ.explanation,
      };
    } else {
      try {
        const row = await one<{
          id: string;
          topic: string;
          prompt: string;
          code_snippet: string | null;
          choices: any;
          correct_index: number;
          hints: any;
          explanation: string;
        }>(`select * from practice_questions where id = $1`, [exerciseId]);
        if (row) {
          exercise = {
            id: row.id,
            concept: row.topic,
            prompt: row.prompt,
            codeSnippet: row.code_snippet || undefined,
            choices: Array.isArray(row.choices) ? row.choices : JSON.parse(row.choices),
            correctIndex: row.correct_index,
            hints: Array.isArray(row.hints) ? row.hints : JSON.parse(row.hints),
            explanation: row.explanation,
          };
        }
      } catch {}
    }
  }

  if (!exercise) {
    exercise = lesson.exercises[0];
  }

  const isCorrect = chosenIndex === exercise.correctIndex;
  const misconceptionMsg = !isCorrect && exercise.misconceptions && exercise.misconceptions[chosenIndex]
    ? exercise.misconceptions[chosenIndex]
    : undefined;

  let feedback = '';
  if (isCorrect) {
    feedback = hintsUsed > 0
      ? `Correct! You solved this using ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''}. Try the next one independently for full mastery credit.`
      : `Outstanding! Correct answer with zero hints. Your mental model on this concept is solid.`;
  } else {
    feedback = misconceptionMsg
      ? `Not quite. ${misconceptionMsg}`
      : `That answer is incorrect. Review the walkthrough and hint, then give it another try.`;
  }

  // Check whether this exercise was already solved correctly by this user
  let alreadySolved = false;
  if (process.env.DATABASE_URL) {
    try {
      const prior = await one<{ count: string }>(
        `select count(*)::text as count from student_practice_attempts 
         where user_id = $1 and question_id = $2 and is_correct = true`,
        [userId, exercise.id]
      );
      if (prior && parseInt(prior.count, 10) > 0) {
        alreadySolved = true;
      }
    } catch {}
  }

  // Update Lesson Progress
  const progressKey = `${userId}:${lesson.id}`;
  let currentProg = memLessonProgress.get(progressKey) || { exercisesCompleted: 0, status: 'in_progress' };

  if (isCorrect && !alreadySolved) {
    currentProg.exercisesCompleted = Math.min(lesson.exercises.length, currentProg.exercisesCompleted + 1);
  }
  const isLessonCompleted = currentProg.exercisesCompleted >= lesson.exercises.length;
  if (isLessonCompleted) {
    currentProg.status = 'completed';
    currentProg.completedAt = new Date().toISOString();
  }
  memLessonProgress.set(progressKey, currentProg);

  // Update Concept Mastery
  const masteryKey = `${userId}:${lesson.skillSlug}:${exercise.concept}`;
  let currentMastery = memConceptMastery.get(masteryKey) || {
    score: 0,
    status: 'novice',
    solved: 0,
    attempted: 0
  };

  currentMastery.attempted += 1;
  if (isCorrect) {
    if (!alreadySolved) {
      currentMastery.solved += 1;
      // Full credit if zero hints used, partial credit if hints used
      const credit = hintsUsed === 0 ? 35 : 20;
      currentMastery.score = Math.min(100, currentMastery.score + credit);
    }
  } else {
    currentMastery.score = Math.max(0, currentMastery.score - 10);
  }

  if (currentMastery.score >= 80 && currentMastery.solved >= 2) {
    currentMastery.status = 'mastered';
  } else if (currentMastery.score >= 50) {
    currentMastery.status = 'proficient';
  } else if (currentMastery.solved >= 1) {
    currentMastery.status = 'practicing';
  } else {
    currentMastery.status = 'novice';
  }
  memConceptMastery.set(masteryKey, currentMastery);

  // Persist to database if connected
  try {
    const database = db();
    await database.query(
      `insert into student_practice_attempts(user_id, skill_slug, topic, question_id, question_prompt, chosen_answer, is_correct, hints_used, feedback)
       values($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        lesson.skillSlug,
        lesson.topic,
        exercise.id,
        exercise.prompt,
        exercise.choices[chosenIndex] || String(chosenIndex),
        isCorrect,
        hintsUsed,
        feedback
      ]
    );

    await database.query(
      `insert into student_lesson_progress(user_id, skill_slug, lesson_id, status, exercises_completed, exercises_total, completed_at)
       values($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, skill_slug, lesson_id) do update set
         status = excluded.status,
         exercises_completed = excluded.exercises_completed,
         last_attempted_at = now(),
         completed_at = case when excluded.status='completed' then now() else student_lesson_progress.completed_at end`,
      [
        userId,
        lesson.skillSlug,
        lesson.id,
        currentProg.status,
        currentProg.exercisesCompleted,
        lesson.exercises.length,
        isLessonCompleted ? new Date() : null
      ]
    );

    await database.query(
      `insert into student_concept_mastery(user_id, skill_slug, concept, mastery_score, status, problems_solved, problems_attempted, last_practiced_at)
       values($1, $2, $3, $4, $5, $6, $7, now())
       on conflict (user_id, skill_slug, concept) do update set
         mastery_score = excluded.mastery_score,
         status = excluded.status,
         problems_solved = excluded.problems_solved,
         problems_attempted = excluded.problems_attempted,
         last_practiced_at = now()`,
      [
        userId,
        lesson.skillSlug,
        exercise.concept,
        currentMastery.score,
        currentMastery.status,
        currentMastery.solved,
        currentMastery.attempted
      ]
    );

    // If concept was just mastered, award verified append-only skill evidence without duplicate entries
    if (currentMastery.status === 'mastered') {
      const skillRow = await database.query(`select id from skills where slug=$1`, [lesson.skillSlug]);
      if (skillRow.rowCount) {
        const existingEvidence = await database.query(
          `select id from user_skill_evidence 
           where user_id = $1 and skill_id = $2 and metadata->>'concept' = $3`,
          [userId, skillRow.rows[0].id, exercise.concept]
        );
        if (existingEvidence.rowCount === 0) {
          await database.query(
            `insert into user_skill_evidence(user_id, skill_id, source, score, confidence, metadata)
             values($1, $2, 'practice', $3, $4, $5)`,
            [
              userId,
              skillRow.rows[0].id,
              currentMastery.score,
              0.85,
              JSON.stringify({
                concept: exercise.concept,
                lessonId: lesson.id,
                solved: currentMastery.solved,
                masteredAt: new Date().toISOString()
              })
            ]
          );
        }
      }
    }
  } catch {
    // Database connection or table unavailable; in-memory fallback maintains state
  }

  // Determine Next-Step Recommendation
  let nextRecommendation = '';
  if (!isCorrect) {
    nextRecommendation = `Review the concept "${exercise.concept.replace(/_/g, ' ')}" walkthrough and attempt a similar exercise to correct your misunderstanding.`;
  } else if (!isLessonCompleted) {
    nextRecommendation = `Great job! Proceed to Exercise ${currentProg.exercisesCompleted + 1} of ${lesson.exercises.length} in this lesson.`;
  } else {
    nextRecommendation = `Lesson complete! You have verified foundational capability in ${lesson.title}. Proceed to your next roadmap milestone or build a hands-on project.`;
  }

  return {
    isCorrect,
    chosenIndex,
    correctIndex: exercise.correctIndex,
    explanation: exercise.explanation,
    feedback,
    misconceptionExplanation: misconceptionMsg,
    nextStepRecommendation: nextRecommendation,
    conceptMastery: {
      concept: exercise.concept,
      level: currentMastery.status,
      score: currentMastery.score,
      problemsSolved: currentMastery.solved
    },
    lessonProgress: {
      lessonId: lesson.id,
      exercisesCompleted: currentProg.exercisesCompleted,
      exercisesTotal: lesson.exercises.length,
      isLessonCompleted
    }
  };
}

/**
 * Gets student progress for a lesson.
 */
export async function getStudentLessonProgress(userId: string, lessonId: string) {
  const mem = memLessonProgress.get(`${userId}:${lessonId}`);
  try {
    const res = await one<{ exercises_completed: number; status: string; completed_at: string | null }>(
      `select exercises_completed, status, completed_at from student_lesson_progress where user_id=$1 and lesson_id=$2`,
      [userId, lessonId]
    );
    if (res) {
      return {
        exercisesCompleted: res.exercises_completed,
        status: res.status,
        completedAt: res.completed_at
      };
    }
  } catch {}

  return {
    exercisesCompleted: mem?.exercisesCompleted || 0,
    status: mem?.status || 'not_started',
    completedAt: mem?.completedAt || null
  };
}
