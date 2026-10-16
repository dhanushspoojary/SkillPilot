export interface AssessmentItemRow { skill_slug: string; prompt: unknown; response: unknown }

/** Items must already be ordered by their `position` column. */
export function nextUnanswered<T extends AssessmentItemRow>(items: T[]): T | undefined {
  return items.find((i) => !i.response);
}

export function answeredCount(items: AssessmentItemRow[]): number {
  return items.filter((i) => !!i.response).length;
}

/** Each skill starts with a medium question and receives one adaptive follow-up; the server may expand this flow later without trusting the client. */
export function totalQuestions(items: AssessmentItemRow[]): number {
  return new Set(items.map((i) => i.skill_slug)).size * 2;
}
