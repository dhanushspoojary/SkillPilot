import { currentUser } from '../../../../../lib/auth.ts';
import { json, requireOrigin, readJsonBody } from '../../../../../lib/server-security.ts';
import { generateContinuousPracticeQuestion } from '../../../../../lib/practice-engine.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  const body = await readJsonBody<{ skillSlug?: string; topic?: string; difficulty?: any }>(req);
  if (!body) {
    return json({ error: 'Invalid JSON request body' }, 400);
  }

  const { skillSlug = 'problem-solving', topic = 'loop_tracing', difficulty = 'foundational' } = body;

  try {
    const question = await generateContinuousPracticeQuestion(skillSlug, topic, difficulty);

    // Sanitize question: return choices, prompt, codeSnippet, hints, id, source, fingerprint
    // DO NOT expose correctIndex or explanation to prevent client inspection prior to answer
    return json({
      question: {
        id: question.id,
        skillSlug: question.skillSlug,
        topic: question.topic,
        difficulty: question.difficulty,
        questionType: question.questionType,
        prompt: question.prompt,
        codeSnippet: question.codeSnippet,
        choices: question.choices,
        hints: question.hints,
        source: question.source,
        fingerprint: question.fingerprint,
      },
    });
  } catch (err: any) {
    console.error('Error generating practice question', err);
    return json({ error: 'Failed to generate practice question' }, 500);
  }
}
