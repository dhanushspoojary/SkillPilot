import { currentUser } from '../../../../lib/auth.ts';
import { json } from '../../../../lib/server-security.ts';
import { getLessonById } from '../../../../lib/lessons-catalog.ts';
import { getStudentLessonProgress } from '../../../../lib/practice-engine.ts';
import { many } from '../../../../lib/db.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return json({ error: 'Missing lesson id parameter' }, 400);
  }

  const lesson = getLessonById(id);
  if (!lesson) {
    return json({ error: 'Lesson not found' }, 404);
  }

  const progress = await getStudentLessonProgress(u.id, lesson.id);

  // Fetch recent attempts for this lesson
  let recentAttempts: any[] = [];
  try {
    recentAttempts = await many(
      `select exercise_id, chosen_index, is_correct, hints_used, created_at
       from student_practice_attempts
       where user_id = $1 and lesson_id = $2
       order by created_at desc limit 20`,
      [u.id, lesson.id]
    );
  } catch {}

  // Fetch concept mastery for concepts covered in this lesson
  let conceptsMastery: Record<string, any> = {};
  try {
    const conceptNames = lesson.exercises.map((e) => e.concept);
    const masteryRows = await many<{
      concept: string;
      mastery_status: string;
      mastery_score: number;
      problems_solved: number;
      problems_attempted: number;
    }>(
      `select concept, mastery_status, mastery_score, problems_solved, problems_attempted
       from student_concept_mastery
       where user_id = $1 and concept = any($2)`,
      [u.id, conceptNames]
    );

    for (const m of masteryRows) {
      conceptsMastery[m.concept] = {
        status: m.mastery_status,
        score: m.mastery_score,
        solved: m.problems_solved,
        attempted: m.problems_attempted,
      };
    }
  } catch {}

  // Sanitize exercises so correctIndex is NOT exposed to client in the initial GET request!
  // Client only receives choices, prompt, codeSnippet, hints, and concept.
  const sanitizedExercises = lesson.exercises.map((ex) => ({
    id: ex.id,
    concept: ex.concept,
    prompt: ex.prompt,
    codeSnippet: ex.codeSnippet,
    choices: ex.choices,
    hints: ex.hints,
    // Do NOT include correctIndex or explanation here to prevent cheating/inspection
  }));

  return json({
    lesson: {
      id: lesson.id,
      skillSlug: lesson.skillSlug,
      title: lesson.title,
      summary: lesson.summary || lesson.subtitle || lesson.introduction,
      whyItMatters: lesson.whyItMatters,
      prerequisites: lesson.prerequisites,
      difficulty: lesson.difficulty,
      estimatedMinutes: typeof lesson.estimatedMinutes === 'number' ? lesson.estimatedMinutes : parseInt(String(lesson.estimatedMinutes).replace(/\D/g, '') || '15', 10),
      keyDefinitions: lesson.keyDefinitions,
      walkthroughSteps: lesson.walkthroughSteps || [
        {
          step: 1,
          title: 'Code Mechanics',
          codeSnippet: lesson.codeWalkthrough.code,
          highlightLines: lesson.codeWalkthrough.annotations.map(a => a.line),
          explanation: lesson.codeWalkthrough.annotations.map(a => `Line ${a.line}: ${a.note}`).join('. '),
          mentalModelNote: lesson.whyItMatters,
        }
      ],
      commonPitfalls: lesson.commonPitfalls.map(p => ({
        misconception: p.misconception || p.title || 'Common Misunderstanding',
        whyItFails: p.whyItFails || p.explanation || 'Fails to model state accurately',
        correctApproach: p.correctApproach || p.example || 'Follow disciplined execution rules',
      })),
      exercises: sanitizedExercises,
    },
    progress,
    recentAttempts,
    conceptsMastery,
  });
}
