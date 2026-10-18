import { one, db } from './db.ts';

export interface StudentCapabilityProfile {
  educationLevel: string;
  programmingExperience: string;
  fieldOfStudy: string;
  careerInterests: string[];
  weeklyHours: number;
  focusAreas: string[];
  skillsToLearn?: string[];
  skillsKnown?: string[];
  onboardingCompleted: boolean;
  preferredPace?: string;
  difficultyPreference?: string;
  primaryFocusSkill?: string;
  dailyMinutes?: number;
  updatedAt?: string;
}

export const DEFAULT_CAPABILITY_PROFILE: StudentCapabilityProfile = {
  educationLevel: 'first_year',
  programmingExperience: 'beginner',
  fieldOfStudy: 'computer_science',
  careerInterests: ['Software Engineer'],
  weeklyHours: 5,
  focusAreas: ['Programming Fundamentals', 'Problem Solving'],
  skillsToLearn: ['Problem Solving', 'Data Structures & Algorithms', 'Web Development'],
  skillsKnown: [],
  onboardingCompleted: false,
  preferredPace: 'moderate',
  difficultyPreference: 'standard',
  primaryFocusSkill: 'problem-solving',
  dailyMinutes: 30,
};

export async function getStudentCapabilityProfile(userId: string): Promise<StudentCapabilityProfile> {
  if (!process.env.DATABASE_URL) {
    return { ...DEFAULT_CAPABILITY_PROFILE };
  }

  try {
    const row = await one<{
      education_level: string;
      programming_experience: string;
      field_of_study: string;
      career_interests: unknown;
      weekly_hours: number;
      focus_areas: unknown;
      skills_to_learn: unknown;
      skills_known: unknown;
      onboarding_completed: boolean;
      preferred_pace?: string;
      difficulty_preference?: string;
      primary_focus_skill?: string;
      daily_minutes?: number;
      updated_at: string;
    }>(
      `select education_level, programming_experience, field_of_study, career_interests, weekly_hours, focus_areas, skills_to_learn, skills_known, onboarding_completed, preferred_pace, difficulty_preference, primary_focus_skill, daily_minutes, updated_at
       from student_capability_profiles where user_id = $1`,
      [userId]
    );

    if (!row) {
      return { ...DEFAULT_CAPABILITY_PROFILE };
    }

    return {
      educationLevel: row.education_level || 'first_year',
      programmingExperience: row.programming_experience || 'beginner',
      fieldOfStudy: row.field_of_study || 'computer_science',
      careerInterests: Array.isArray(row.career_interests) ? row.career_interests : ['Software Engineer'],
      weeklyHours: Number(row.weekly_hours) || 5,
      focusAreas: Array.isArray(row.focus_areas) ? row.focus_areas : [],
      skillsToLearn: Array.isArray(row.skills_to_learn) ? row.skills_to_learn : ['Problem Solving', 'Web Development'],
      skillsKnown: Array.isArray(row.skills_known) ? row.skills_known : [],
      onboardingCompleted: Boolean(row.onboarding_completed),
      preferredPace: row.preferred_pace || 'moderate',
      difficultyPreference: row.difficulty_preference || 'standard',
      primaryFocusSkill: row.primary_focus_skill || 'problem-solving',
      dailyMinutes: Number(row.daily_minutes) || 30,
      updatedAt: row.updated_at,
    };
  } catch {
    return { ...DEFAULT_CAPABILITY_PROFILE };
  }
}

export async function saveStudentCapabilityProfile(
  userId: string,
  profile: Partial<StudentCapabilityProfile>
): Promise<StudentCapabilityProfile> {
  const current = await getStudentCapabilityProfile(userId);
  const updated: StudentCapabilityProfile = {
    educationLevel: profile.educationLevel ?? current.educationLevel,
    programmingExperience: profile.programmingExperience ?? current.programmingExperience,
    fieldOfStudy: profile.fieldOfStudy ?? current.fieldOfStudy,
    careerInterests: profile.careerInterests ?? current.careerInterests,
    weeklyHours: profile.weeklyHours ?? current.weeklyHours,
    focusAreas: profile.focusAreas ?? current.focusAreas,
    skillsToLearn: profile.skillsToLearn ?? current.skillsToLearn ?? [],
    skillsKnown: profile.skillsKnown ?? current.skillsKnown ?? [],
    onboardingCompleted: profile.onboardingCompleted ?? true,
    preferredPace: profile.preferredPace ?? current.preferredPace ?? 'moderate',
    difficultyPreference: profile.difficultyPreference ?? current.difficultyPreference ?? 'standard',
    primaryFocusSkill: profile.primaryFocusSkill ?? current.primaryFocusSkill ?? 'problem-solving',
    dailyMinutes: profile.dailyMinutes ?? current.dailyMinutes ?? 30,
  };

  if (!process.env.DATABASE_URL) {
    return updated;
  }

  try {
    await db().query(
      `insert into student_capability_profiles (
         user_id, education_level, programming_experience, field_of_study,
         career_interests, weekly_hours, focus_areas, skills_to_learn, skills_known,
         onboarding_completed, preferred_pace, difficulty_preference, primary_focus_skill,
         daily_minutes, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
       on conflict (user_id) do update set
         education_level = excluded.education_level,
         programming_experience = excluded.programming_experience,
         field_of_study = excluded.field_of_study,
         career_interests = excluded.career_interests,
         weekly_hours = excluded.weekly_hours,
         focus_areas = excluded.focus_areas,
         skills_to_learn = excluded.skills_to_learn,
         skills_known = excluded.skills_known,
         onboarding_completed = excluded.onboarding_completed,
         preferred_pace = excluded.preferred_pace,
         difficulty_preference = excluded.difficulty_preference,
         primary_focus_skill = excluded.primary_focus_skill,
         daily_minutes = excluded.daily_minutes,
         updated_at = now()`,
      [
        userId,
        updated.educationLevel,
        updated.programmingExperience,
        updated.fieldOfStudy,
        JSON.stringify(updated.careerInterests),
        updated.weeklyHours,
        JSON.stringify(updated.focusAreas),
        JSON.stringify(updated.skillsToLearn),
        JSON.stringify(updated.skillsKnown),
        updated.onboardingCompleted,
        updated.preferredPace,
        updated.difficultyPreference,
        updated.primaryFocusSkill,
        updated.dailyMinutes,
      ]
    );
  } catch (err) {
    console.error('Failed to persist student capability profile', err);
  }

  return updated;
}
