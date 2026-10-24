import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAssessmentQuestion,
  type ValidatedAssessmentQuestion,
} from './question-contract.ts';

describe('Assessment Question Contract & Runtime Validation', () => {
  it('validates a correct multiple-choice question', () => {
    const raw = {
      id: 'mc-1',
      skill: 'javascript',
      level: 2,
      q: 'What is the return type of typeof null?',
      options: ['object', 'null', 'undefined', 'boolean'],
      answer: 0,
      why: 'In JavaScript, typeof null returning object is a legacy language quirk.',
    };

    const res = validateAssessmentQuestion(raw);
    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.question.type, 'multiple_choice');
      assert.equal(res.question.options.length, 4);
      assert.equal(res.question.options[0], 'object');
    }
  });

  it('rejects questions with null options (root-cause crash prevention)', () => {
    const raw = {
      id: 'mc-null-opts',
      skill: 'problem-solving',
      level: 1,
      q: 'Explain loop invariant conditions',
      options: null,
    };

    const res = validateAssessmentQuestion(raw);
    assert.equal(res.valid, false);
    if (!res.valid) {
      assert.match(res.error, /options defined as null/i);
    }
  });

  it('rejects questions with missing options', () => {
    const raw = {
      id: 'mc-missing-opts',
      skill: 'sql',
      level: 1,
      q: 'What does SELECT do?',
    };

    const res = validateAssessmentQuestion(raw);
    assert.equal(res.valid, false);
    if (!res.valid) {
      assert.match(res.error, /missing options/i);
    }
  });

  it('rejects questions with empty options array', () => {
    const raw = {
      id: 'mc-empty-opts',
      skill: 'git',
      level: 1,
      q: 'What does git status show?',
      options: [],
    };

    const res = validateAssessmentQuestion(raw);
    assert.equal(res.valid, false);
    if (!res.valid) {
      assert.match(res.error, /insufficient options/i);
    }
  });

  it('rejects questions with only 1 option', () => {
    const raw = {
      id: 'mc-one-opt',
      skill: 'rest-apis',
      level: 1,
      q: 'Is GET safe?',
      options: ['Yes'],
    };

    const res = validateAssessmentQuestion(raw);
    assert.equal(res.valid, false);
    if (!res.valid) {
      assert.match(res.error, /insufficient options/i);
    }
  });

  it('rejects questions with invalid option elements (null, numbers, or whitespace)', () => {
    const raw = {
      id: 'mc-bad-element',
      skill: 'javascript',
      level: 1,
      q: 'Choose an option',
      options: ['Valid', null, 'Another'],
    };

    const res = validateAssessmentQuestion(raw);
    assert.equal(res.valid, false);
    if (!res.valid) {
      assert.match(res.error, /option at index 1 is invalid/i);
    }
  });

  it('validates supported non-multiple-choice question types (conceptual, code_tracing, debugging, practical)', () => {
    const rawConceptual = {
      id: 'conc-1',
      skill: 'problem-solving',
      level: 2,
      type: 'conceptual',
      q: 'Explain the difference between a stack and a queue in your own words.',
      options: null,
    };

    const res = validateAssessmentQuestion(rawConceptual);
    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.question.type, 'conceptual');
      assert.equal(res.question.options, null);
      assert.equal(res.question.q.includes('stack and a queue'), true);
    }

    const rawTracing = {
      id: 'trace-1',
      skill: 'javascript',
      level: 3,
      type: 'code_tracing',
      q: 'Trace what will be logged to the console when foo() is called:',
      codeSnippet: 'function foo() { let a = 1; { let a = 2; console.log(a); } console.log(a); }',
      options: null,
    };

    const resTrace = validateAssessmentQuestion(rawTracing);
    assert.equal(resTrace.valid, true);
    if (resTrace.valid) {
      assert.equal(resTrace.question.type, 'code_tracing');
      assert.equal(resTrace.question.codeSnippet?.includes('let a = 1'), true);
    }
  });

  it('rejects malformed question objects (missing id, skill, or question text)', () => {
    assert.equal(validateAssessmentQuestion(null).valid, false);
    assert.equal(validateAssessmentQuestion(undefined).valid, false);
    assert.equal(validateAssessmentQuestion('not-an-object').valid, false);
    assert.equal(validateAssessmentQuestion({ skill: 'js', q: 'Hello' }).valid, false);
    assert.equal(validateAssessmentQuestion({ id: '1', q: 'Hello' }).valid, false);
    assert.equal(validateAssessmentQuestion({ id: '1', skill: 'js' }).valid, false);
  });

  it('handles field alias normalization (text/prompt -> q, skill_slug -> skill, difficulty -> level)', () => {
    const rawAlias = {
      question_id: 'alias-1',
      skill_slug: 'sql',
      difficulty: 3,
      text: 'What is a B-Tree index?',
      options: ['A balanced tree index', 'A bitmap index'],
    };

    const res = validateAssessmentQuestion(rawAlias);
    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.question.id, 'alias-1');
      assert.equal(res.question.skill, 'sql');
      assert.equal(res.question.level, 3);
      assert.equal(res.question.q, 'What is a B-Tree index?');
    }
  });

  it('rejects completely unsupported question types', () => {
    const raw = {
      id: 'unsupported-1',
      skill: 'problem-solving',
      level: 1,
      type: 'virtual_reality_simulation',
      q: 'Put on headset',
    };

    const res = validateAssessmentQuestion(raw);
    assert.equal(res.valid, false);
    if (!res.valid) {
      assert.match(res.error, /unsupported question type/i);
    }
  });
});
