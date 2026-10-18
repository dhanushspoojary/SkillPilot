import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTurnId,
  inferTopic,
  sanitizeDialogueTurns,
  mergeOrAppendTurn,
  ONBOARDING_TOPIC_CONFIGS,
  type OnboardingTurn,
} from './onboarding-dialogue.ts';

test('generateTurnId produces unique, topic-prefixed keys across rapid calls', () => {
  const ids = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const id = generateTurnId('education');
    assert.match(id, /^turn-education-/);
    assert.equal(ids.has(id), false, `Duplicate key detected: ${id}`);
    ids.add(id);
  }
  assert.equal(ids.size, 100);
});

test('sanitizeDialogueTurns handles null, undefined, or empty inputs safely', () => {
  assert.deepEqual(sanitizeDialogueTurns(null), []);
  assert.deepEqual(sanitizeDialogueTurns(undefined), []);
  assert.deepEqual(sanitizeDialogueTurns('invalid' as any), []);
  assert.deepEqual(sanitizeDialogueTurns([]), []);
});

test('sanitizeDialogueTurns eliminates duplicate "turn-1" IDs and prevents key collisions in React', () => {
  const legacyDuplicateTurns: OnboardingTurn[] = [
    {
      id: 'turn-1',
      topic: 'education',
      question: 'Which best describes your college stage?',
      answer: '1st Year Student',
    },
    {
      id: 'turn-1', // duplicate key from legacy storage/stale state
      topic: 'experience',
      question: 'How would you describe your coding experience?',
      answer: 'Complete Beginner',
    },
    {
      id: 'turn-1', // third duplicate key
      topic: 'struggles',
      question: 'Which concepts feel unfamiliar?',
      answer: 'Pointers and memory layout',
    },
  ];

  const sanitized = sanitizeDialogueTurns(legacyDuplicateTurns);

  assert.equal(sanitized.length, 3);
  // Answers and questions must remain intact
  assert.equal(sanitized[0].answer, '1st Year Student');
  assert.equal(sanitized[1].answer, 'Complete Beginner');
  assert.equal(sanitized[2].answer, 'Pointers and memory layout');

  // All resulting IDs must be strictly unique
  const uniqueIds = new Set(sanitized.map((t) => t.id));
  assert.equal(uniqueIds.size, 3, 'All turns must have strictly unique IDs');
  assert.equal(uniqueIds.has(''), false, 'No turn may have an empty ID');
});

test('sanitizeDialogueTurns handles legacy duplicate IDs with missing topics without merging legitimate answers', () => {
  // Legacy data where topic was not stored and both records had id: 'turn-1'
  const legacyUntypedTurns = [
    {
      id: 'turn-1',
      question: 'What is your current academic stage or background in college?',
      answer: '1st Year Student',
    },
    {
      id: 'turn-1',
      question: 'How would you describe your coding and programming experience?',
      answer: 'Complete Beginner',
    },
  ];

  const sanitized = sanitizeDialogueTurns(legacyUntypedTurns);

  // Both distinct answers must be preserved, not merged into one
  assert.equal(sanitized.length, 2, 'Must not discard or collapse distinct questions with missing topics');
  assert.equal(sanitized[0].answer, '1st Year Student');
  assert.equal(sanitized[1].answer, 'Complete Beginner');
  assert.equal(sanitized[0].topic, 'education');
  assert.equal(sanitized[1].topic, 'experience');
  assert.notEqual(sanitized[0].id, sanitized[1].id, 'Both must receive unique IDs');
});

test('sanitizeDialogueTurns deduplicates duplicate answers for the same topic and question in-place', () => {
  const duplicatedTopicTurns: OnboardingTurn[] = [
    {
      id: 'turn-education-1',
      topic: 'education',
      question: 'Which best describes your college stage?',
      answer: '1st Year Student',
    },
    {
      id: 'turn-education-2',
      topic: 'education',
      question: 'Which best describes your college stage?',
      answer: '2nd Year Student (Updated)',
    },
  ];

  const sanitized = sanitizeDialogueTurns(duplicatedTopicTurns);
  assert.equal(sanitized.length, 1, 'Duplicate topic entries should be collapsed to one');
  assert.equal(sanitized[0].answer, '2nd Year Student (Updated)');
});

test('mergeOrAppendTurn updates in-place and preserves the existing React key for stability', () => {
  const stableId = 'turn-education-original-key';
  const initialTurns: OnboardingTurn[] = [
    {
      id: stableId,
      topic: 'education',
      question: 'Stage?',
      answer: '1st Year Student',
    },
  ];

  // Re-answering the question
  const updated = mergeOrAppendTurn(initialTurns, {
    id: 'turn-education-new-temporary-id',
    topic: 'education',
    question: 'Stage?',
    answer: '2nd Year Student',
  });

  assert.equal(updated.length, 1, 'Must not duplicate turn in state array');
  assert.equal(updated[0].answer, '2nd Year Student');
  // Critical for Point 2: React key must remain unchanged to prevent DOM node re-creation
  assert.equal(updated[0].id, stableId, 'React key must remain stable when updating an answer');
});

test('inferTopic accurately identifies topic from question contents or sequence', () => {
  assert.equal(inferTopic('education'), 'education');
  assert.equal(inferTopic(undefined, 'What is your college academic year?'), 'education');
  assert.equal(inferTopic(undefined, 'How much programming or coding have you done?'), 'experience');
  assert.equal(inferTopic(undefined, 'Which concepts or pointers feel difficult?'), 'struggles');
  assert.equal(inferTopic(undefined, 'What career role or software engineer goal do you have?'), 'goals');
  assert.equal(inferTopic(undefined, 'Which programming languages or tools have you worked with?'), 'skills_used');
  assert.equal(inferTopic(undefined, 'Completely custom question', 3), 'struggles');
  assert.equal(inferTopic(undefined, 'Completely custom question', 4), 'goals');
});

test('ONBOARDING_TOPIC_CONFIGS has all required foundational stages in logical order', () => {
  const topics = ONBOARDING_TOPIC_CONFIGS.map((c) => c.topic);
  assert.deepEqual(topics, [
    'education',
    'experience',
    'skills_used',
    'struggles',
    'goals',
    'availability',
    'format_pace',
  ]);
});
