import { currentUser } from '../../../../lib/auth';
import { json } from '../../../../lib/server-security';
import { LESSONS_CATALOG } from '../../../../lib/lessons-catalog';
import { many } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  try {
    const progressRows = await many<{
      lesson_id: string;
      exercises_completed: number;
      status: string;
      completed_at: string | null;
    }>(
      `select lesson_id, exercises_completed, status, completed_at
       from student_lesson_progress
       where user_id = $1`,
      [u.id]
    ).catch(() => []);

    const progressMap = new Map<string, { exercisesCompleted: number; status: string; completedAt: string | null }>();
    for (const r of progressRows) {
      progressMap.set(r.lesson_id, {
        exercisesCompleted: r.exercises_completed,
        status: r.status,
        completedAt: r.completed_at,
      });
    }

    const lessons = LESSONS_CATALOG.map((lesson) => {
      const prog = progressMap.get(lesson.id) || {
        exercisesCompleted: 0,
        status: 'not_started',
        completedAt: null,
      };

      return {
        id: lesson.id,
        skillSlug: lesson.skillSlug,
        title: lesson.title,
        summary: lesson.summary || lesson.subtitle || lesson.introduction,
        whyItMatters: lesson.whyItMatters,
        difficulty: lesson.difficulty,
        estimatedMinutes: typeof lesson.estimatedMinutes === 'number' ? lesson.estimatedMinutes : parseInt(String(lesson.estimatedMinutes).replace(/\D/g, '') || '15', 10),
        prerequisites: lesson.prerequisites,
        exercisesTotal: lesson.exercises.length,
        exercisesCompleted: prog.exercisesCompleted,
        status: prog.status,
        completedAt: prog.completedAt,
      };
    });

    return json({ lessons });
  } catch (err) {
    console.error('Error fetching lessons', err);
    return json({ error: 'Failed to retrieve lessons' }, 500);
  }
}
