import { currentUser } from '../../../../lib/auth';
import { json } from '../../../../lib/server-security';
import { getLessonById } from '../../../../lib/lessons-catalog';
import { getStudentLessonProgress } from '../../../../lib/practice-engine';
import { many } from '../../../../lib/db';

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
    const exerciseIds = lesson.exercises.map((e) => e.id);
    if (exerciseIds.length > 0) {
      recentAttempts = await many(
        `select question_id as exercise_id, is_correct, hints_used, created_at
         from student_practice_attempts
         where user_id = $1 and question_id = any($2)
         order by created_at desc limit 20`,
        [u.id, exerciseIds]
      );
    }
  } catch {}

  // Fetch concept mastery for concepts covered in this lesson
  let conceptsMastery: Record<string, any> = {};
  try {
    const conceptNames = lesson.exercises.map((e) => e.concept);
    if (conceptNames.length > 0) {
      const masteryRows = await many<{
        concept: string;
        status: string;
        mastery_score: number;
        problems_solved: number;
        problems_attempted: number;
      }>(
        `select concept, status, mastery_score, problems_solved, problems_attempted
         from student_concept_mastery
         where user_id = $1 and concept = any($2)`,
        [u.id, conceptNames]
      );

      for (const m of masteryRows) {
        conceptsMastery[m.concept] = {
          status: m.status,
          score: m.mastery_score,
          solved: m.problems_solved,
          attempted: m.problems_attempted,
        };
      }
    }
  } catch {}

  // Sanitize exercises so correctIndex is NOT exposed to client in the initial GET request!
  // Client only receives choices, prompt, codeSnippet, hints, and concept.
  const sanitizedExercises = lesson.exercises.map((ex) => ({
    id: ex.id,
    concept: ex.concept,
    prompt: ex.prompt,
    codeSnippet: ex.codeSnippet,
    language: ex.language || lesson.language || lesson.codeWalkthrough.language || 'c',
    choices: ex.choices,
    hints: ex.hints,
    // Do NOT include correctIndex or explanation here to prevent cheating/inspection
  }));

  return json({
    lesson: {
      id: lesson.id,
      skillSlug: lesson.skillSlug,
      language: lesson.language || lesson.codeWalkthrough.language || 'c',
      title: lesson.title,
      summary: lesson.summary || lesson.subtitle || lesson.introduction,
      whyItMatters: lesson.whyItMatters,
      prerequisites: lesson.prerequisites,
      difficulty: lesson.difficulty,
      estimatedMinutes: typeof lesson.estimatedMinutes === 'number' ? lesson.estimatedMinutes : parseInt(String(lesson.estimatedMinutes).replace(/\D/g, '') || '15', 10),
      keyDefinitions: lesson.keyDefinitions,
      walkthroughSteps: lesson.walkthroughSteps || (
        lesson.codeWalkthrough.annotations.length > 0
          ? lesson.codeWalkthrough.annotations.map((ann, idx) => ({
              step: idx + 1,
              title: `Line ${ann.line} Execution Trace`,
              codeSnippet: lesson.codeWalkthrough.code,
              language: lesson.language || lesson.codeWalkthrough.language || 'c',
              highlightLines: [ann.line],
              explanation: ann.note,
              mentalModelNote: `Simulate line ${ann.line} state changes carefully in memory.`,
            }))
          : [
              {
                step: 1,
                title: 'Code Mechanics',
                codeSnippet: lesson.codeWalkthrough.code,
                language: lesson.language || lesson.codeWalkthrough.language || 'c',
                highlightLines: [1],
                explanation: 'Inspect the code structure and state evolution.',
                mentalModelNote: lesson.whyItMatters,
              }
            ]
      ),
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
