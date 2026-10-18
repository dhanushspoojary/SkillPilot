import { db, many, one } from './db.ts';
import {
  getStudentCapabilityProfile,
  saveStudentCapabilityProfile,
  type StudentCapabilityProfile,
} from './capability-profile.ts';
import { planActions, SKILL_PREREQUISITES } from './engine.ts';
import { PREREQUISITES } from './assessment-planner.ts';
import type { AppState, PlanAction } from './types.ts';

export interface PreferenceChangeRecord {
  id: string;
  userId: string;
  requestText: string;
  changeType: 'pace' | 'difficulty' | 'focus_skill' | 'daily_minutes' | 'weekly_hours' | 'career_goal' | 'reversal' | 'roadmap_refresh';
  previousValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  reasoning: string;
  createdAt: string;
}

export interface PreferenceChangeResult {
  applied: boolean;
  changeType: string;
  summary: string;
  details: {
    previous: Record<string, unknown>;
    updated: Record<string, unknown>;
  };
  conflictWarning?: string;
  recommendedAlternative?: string;
  newTopAction?: PlanAction;
}

const inMemoryPreferenceHistory: PreferenceChangeRecord[] = [];

/**
 * Audit-log a roadmap preference change with strict change history.
 */
export async function recordRoadmapPreferenceChange(
  userId: string,
  requestText: string,
  changeType: PreferenceChangeRecord['changeType'],
  previousValue: Record<string, unknown>,
  newValue: Record<string, unknown>,
  reasoning: string,
): Promise<void> {
  const record: PreferenceChangeRecord = {
    id: `pref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    requestText: requestText.slice(0, 500),
    changeType,
    previousValue,
    newValue,
    reasoning,
    createdAt: new Date().toISOString(),
  };
  inMemoryPreferenceHistory.unshift(record);

  if (!process.env.DATABASE_URL) return;

  await db().query(
    `insert into roadmap_preference_changes (
       user_id, request_text, change_type, previous_value, new_value, reasoning, created_at
     ) values ($1, $2, $3, $4, $5, $6, now())`,
    [userId, requestText.slice(0, 500), changeType, JSON.stringify(previousValue), JSON.stringify(newValue), reasoning],
  ).catch((err) => {
    console.error('Failed to log roadmap preference change', err);
  });
}

/**
 * Retrieve audited change history for student.
 */
export async function getRoadmapPreferenceHistory(userId: string, limit = 10): Promise<PreferenceChangeRecord[]> {
  if (!process.env.DATABASE_URL) {
    return inMemoryPreferenceHistory.filter((r) => r.userId === userId).slice(0, limit);
  }

  const rows = await many<{
    id: string;
    user_id: string;
    request_text: string;
    change_type: PreferenceChangeRecord['changeType'];
    previous_value: unknown;
    new_value: unknown;
    reasoning: string;
    created_at: string;
  }>(
    `select id, user_id, request_text, change_type, previous_value, new_value, reasoning, created_at
     from roadmap_preference_changes
     where user_id = $1
     order by created_at desc
     limit $2`,
    [userId, limit],
  ).catch(() => []);

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    requestText: r.request_text,
    changeType: r.change_type,
    previousValue: (typeof r.previous_value === 'object' && r.previous_value !== null ? r.previous_value : {}) as Record<string, unknown>,
    newValue: (typeof r.new_value === 'object' && r.new_value !== null ? r.new_value : {}) as Record<string, unknown>,
    reasoning: r.reasoning,
    createdAt: r.created_at,
  }));
}

/**
 * Natural language intent parser and preference validator.
 * Validates dependencies and prerequisite constraints before mutating.
 */
export async function handleNaturalLanguagePreferenceRequest(
  userId: string,
  requestText: string,
  state: AppState,
): Promise<PreferenceChangeResult> {
  const text = requestText.trim().toLowerCase();
  const currentProfile = await getStudentCapabilityProfile(userId);

  // 1. "explain simpler" / "simpler explanations" / "easier"
  if (/explain\s+simpler|simpler\s+explanation|make\s+it\s+simpler|easier\s+explanation|break\s+it\s+down\s+simpler/i.test(text)) {
    const prev = { difficultyPreference: currentProfile.difficultyPreference || 'standard' };
    const updated = { difficultyPreference: 'simpler_explanations' };
    await saveStudentCapabilityProfile(userId, { difficultyPreference: 'simpler_explanations' });
    const reasoning = 'Adjusted learning explanations and task difficulty to prioritize foundational mental models and plain-language analogies.';
    await recordRoadmapPreferenceChange(userId, requestText, 'difficulty', prev, updated, reasoning);

    const newActions = planActions(state, undefined, { ...currentProfile, ...updated });
    return {
      applied: true,
      changeType: 'difficulty',
      summary: 'Updated explanation mode to Simpler & Mental-Model focused',
      details: { previous: prev, updated },
      newTopAction: newActions[0],
    };
  }

  // 2. "I have 20 minutes" / "20 mins daily" / "available 20 minutes"
  const minMatch = text.match(/(\d+)\s*(?:min|minute|minutes)/i);
  if (minMatch || /short\s+session|quick\s+practice|limited\s+time/i.test(text)) {
    const minutes = minMatch ? Math.max(10, Math.min(120, parseInt(minMatch[1], 10))) : 20;
    const weeklyHours = Math.max(1, Math.round((minutes * 7) / 60));
    const prev = { dailyMinutes: currentProfile.dailyMinutes || 30, weeklyHours: currentProfile.weeklyHours || 5 };
    const updated = { dailyMinutes: minutes, weeklyHours };

    await saveStudentCapabilityProfile(userId, { dailyMinutes: minutes, weeklyHours });
    const reasoning = `Re-calibrated roadmap tasks and adaptive diagnostics to fit a ${minutes}-minute daily schedule (${weeklyHours}h weekly).`;
    await recordRoadmapPreferenceChange(userId, requestText, 'daily_minutes', prev, updated, reasoning);

    const newActions = planActions(state, undefined, { ...currentProfile, ...updated });
    return {
      applied: true,
      changeType: 'daily_minutes',
      summary: `Calibrated daily practice plan to ${minutes} minutes daily`,
      details: { previous: prev, updated },
      newTopAction: newActions[0],
    };
  }

  // 3. "focus on C first" / "c first" / "prioritize C" / "focus on problem solving"
  if (/focus\s+on\s+c|c\s+first|learn\s+c\s+first|prioritize\s+c|focus\s+on\s+problem\s+solving/i.test(text)) {
    const prev = { primaryFocusSkill: currentProfile.primaryFocusSkill || 'problem-solving' };
    const updated = { primaryFocusSkill: 'problem-solving' };

    await saveStudentCapabilityProfile(userId, { primaryFocusSkill: 'problem-solving' });
    const reasoning = 'Prioritized Problem Solving & C memory foundations at the top of your personalized roadmap.';
    await recordRoadmapPreferenceChange(userId, requestText, 'focus_skill', prev, updated, reasoning);

    const newActions = planActions(state, undefined, { ...currentProfile, ...updated });
    return {
      applied: true,
      changeType: 'focus_skill',
      summary: 'Set primary roadmap focus to C Programming & Problem Solving',
      details: { previous: prev, updated },
      newTopAction: newActions[0],
    };
  }

  // 4. "harder challenge" / "more challenging" / "advanced questions"
  if (/harder\s+challenge|more\s+challenging|advanced\s+exercises|raise\s+difficulty|harder\s+problems/i.test(text)) {
    const prev = { difficultyPreference: currentProfile.difficultyPreference || 'standard' };
    const updated = { difficultyPreference: 'harder_challenge' };

    await saveStudentCapabilityProfile(userId, { difficultyPreference: 'harder_challenge' });
    const reasoning = 'Elevated challenge level to advanced implementation and edge-case boundary analysis.';
    await recordRoadmapPreferenceChange(userId, requestText, 'difficulty', prev, updated, reasoning);

    const newActions = planActions(state, undefined, { ...currentProfile, ...updated });
    return {
      applied: true,
      changeType: 'difficulty',
      summary: 'Updated learning challenge mode to Advanced & Boundary-Testing',
      details: { previous: prev, updated },
      newTopAction: newActions[0],
    };
  }

  // 5. "fewer questions" / "less questions" / "fewer diagnostic questions"
  if (/fewer\s+questions|less\s+questions|fewer\s+diagnostic|relaxed\s+pace|shorter\s+quiz/i.test(text)) {
    const prev = { preferredPace: currentProfile.preferredPace || 'moderate' };
    const updated = { preferredPace: 'fewer_questions_relaxed' };

    await saveStudentCapabilityProfile(userId, { preferredPace: 'fewer_questions_relaxed' });
    const reasoning = 'Reduced assessment question volume to 2 concise diagnostic probes per session to prevent test fatigue.';
    await recordRoadmapPreferenceChange(userId, requestText, 'pace', prev, updated, reasoning);

    const newActions = planActions(state, undefined, { ...currentProfile, ...updated });
    return {
      applied: true,
      changeType: 'pace',
      summary: 'Reduced diagnostic volume to concise 2-question sessions',
      details: { previous: prev, updated },
      newTopAction: newActions[0],
    };
  }

  // 6. Prerequisite conflict check (e.g. "focus on rest apis first" / "jump to sql" before problem-solving)
  if (/focus\s+on\s+rest|focus\s+on\s+api|apis\s+first|backend\s+first/i.test(text)) {
    // Check if problem-solving or javascript are verified
    const psEvidence = state.evidence.filter((e) => e.skill === 'problem-solving');
    const psScore = psEvidence.length ? Math.max(...psEvidence.map((e) => e.score)) : 0;
    const jsEvidence = state.evidence.filter((e) => e.skill === 'javascript');
    const jsScore = jsEvidence.length ? Math.max(...jsEvidence.map((e) => e.score)) : 0;

    if (psScore < 70 || jsScore < 70) {
      // Conflict detected!
      const warning = 'REST APIs require prerequisite foundational JavaScript and Problem Solving first.';
      const alternative = 'We have scheduled Problem Solving and JavaScript as immediate prerequisites so you can advance to REST APIs with confidence.';

      const prev = { primaryFocusSkill: currentProfile.primaryFocusSkill || 'problem-solving' };
      const updated = { primaryFocusSkill: 'problem-solving' };
      await saveStudentCapabilityProfile(userId, { primaryFocusSkill: 'problem-solving' });
      await recordRoadmapPreferenceChange(
        userId,
        requestText,
        'focus_skill',
        prev,
        updated,
        `Student requested REST APIs first, but prerequisites (Problem Solving/JavaScript) are not yet verified. Diverted to foundational Problem Solving.`,
      );

      const newActions = planActions(state, undefined, { ...currentProfile, ...updated });
      return {
        applied: true,
        changeType: 'focus_skill',
        summary: 'Scheduled prerequisite Problem Solving before REST APIs',
        details: { previous: prev, updated },
        conflictWarning: warning,
        recommendedAlternative: alternative,
        newTopAction: newActions[0],
      };
    }
  }

  // 7. "why this?" / "why this action?" / "why this task?"
  if (/why\s+this|why\s+this\s+action|why\s+this\s+task|why\s+am\s+i\s+doing\s+this/i.test(text)) {
    const actions = planActions(state, undefined, currentProfile);
    const top = actions[0];
    return {
      applied: false,
      changeType: 'explanation',
      summary: top ? `Why "${top.title}" is your priority: ${top.reason}` : 'All target skills are verified.',
      details: {
        previous: {},
        updated: top ? { title: top.title, reason: top.reason, impact: `+${top.upTo}% readiness` } : {},
      },
      newTopAction: top,
    };
  }

  // 8. "undo" / "revert last change" / "undo my preference change"
  if (/\b(undo|revert|revert\s+change|undo\s+last|revert\s+last)\b/i.test(text)) {
    const undoResult = await revertLastRoadmapPreferenceChange(userId, state);
    if (!undoResult.success) {
      return {
        applied: false,
        changeType: 'reversal',
        summary: undoResult.message,
        details: { previous: {}, updated: {} },
      };
    }
    return {
      applied: true,
      changeType: 'reversal',
      summary: undoResult.message,
      details: {
        previous: undoResult.revertedChange?.newValue || {},
        updated: undoResult.revertedChange?.previousValue || {},
      },
      newTopAction: undoResult.newTopAction,
    };
  }

  // 9. "change my roadmap" / "update my roadmap" (General refresh)
  const prev = { updatedAt: currentProfile.updatedAt || 'initial' };
  const updated = { updatedAt: new Date().toISOString() };
  await saveStudentCapabilityProfile(userId, {});
  await recordRoadmapPreferenceChange(
    userId,
    requestText,
    'pace',
    prev,
    updated,
    'Regenerated personalized roadmap prioritizing highest remaining verified gaps.',
  );
  const newActions = planActions(state, undefined, currentProfile);

  return {
    applied: true,
    changeType: 'roadmap_refresh',
    summary: 'Refreshed personalized roadmap preserving all completed progress',
    details: { previous: prev, updated },
    newTopAction: newActions[0],
  };
}

/**
 * Reverts the most recent roadmap preference modification for the student.
 * Restores previous values to student_capability_profiles and audits the reversal.
 */
export async function revertLastRoadmapPreferenceChange(
  userId: string,
  state: AppState,
): Promise<{
  success: boolean;
  message: string;
  revertedChange?: PreferenceChangeRecord;
  restoredProfile?: Partial<StudentCapabilityProfile>;
  newTopAction?: PlanAction;
}> {
  let lastChange: {
    id: string;
    user_id: string;
    request_text: string;
    change_type: PreferenceChangeRecord['changeType'];
    previous_value: unknown;
    new_value: unknown;
    reasoning: string;
    created_at: string;
  } | null = null;

  if (!process.env.DATABASE_URL) {
    const mem = inMemoryPreferenceHistory.find((r) => r.userId === userId && r.changeType !== 'reversal');
    if (mem) {
      lastChange = {
        id: mem.id,
        user_id: mem.userId,
        request_text: mem.requestText,
        change_type: mem.changeType,
        previous_value: mem.previousValue,
        new_value: mem.newValue,
        reasoning: mem.reasoning,
        created_at: mem.createdAt,
      };
    }
  } else {
    lastChange = await one<{
      id: string;
      user_id: string;
      request_text: string;
      change_type: PreferenceChangeRecord['changeType'];
      previous_value: unknown;
      new_value: unknown;
      reasoning: string;
      created_at: string;
    }>(
      `select id, user_id, request_text, change_type, previous_value, new_value, reasoning, created_at
       from roadmap_preference_changes
       where user_id = $1 and change_type != 'reversal'
       order by created_at desc
       limit 1`,
      [userId],
    ).catch(() => null);
  }

  if (!lastChange || !lastChange.previous_value) {
    return { success: false, message: 'No prior preference changes to revert.' };
  }

  const prev = (typeof lastChange.previous_value === 'object' && lastChange.previous_value !== null
    ? lastChange.previous_value
    : {}) as Record<string, unknown>;

  const current = (typeof lastChange.new_value === 'object' && lastChange.new_value !== null
    ? lastChange.new_value
    : {}) as Record<string, unknown>;

  // Restore previous values
  await saveStudentCapabilityProfile(userId, prev);

  // Record reversal in change history
  await recordRoadmapPreferenceChange(
    userId,
    `Undo: Reverted "${lastChange.request_text}"`,
    'reversal',
    current,
    prev,
    `Student initiated undo. Restored prior settings.`,
  );

  const updatedProfile = await getStudentCapabilityProfile(userId);
  const newActions = planActions(state, undefined, updatedProfile);

  return {
    success: true,
    message: `Successfully reverted change "${lastChange.request_text}". Prior settings restored.`,
    revertedChange: {
      id: lastChange.id,
      userId: lastChange.user_id,
      requestText: lastChange.request_text,
      changeType: lastChange.change_type,
      previousValue: prev,
      newValue: current,
      reasoning: lastChange.reasoning,
      createdAt: lastChange.created_at,
    },
    restoredProfile: prev,
    newTopAction: newActions[0],
  };
}
