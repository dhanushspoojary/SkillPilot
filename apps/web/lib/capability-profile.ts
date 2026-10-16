import { one, db } from './db.ts';

export interface StudentCapabilityProfile {
  educationLevel: string;
  programmingExperience: string;
  fieldOfStudy: string;
  careerInterests: string[];
  weeklyHours: number;
  focusAreas: string[];
  onboardingCompleted: boolean;
  updatedAt?: string;
}

export const DEFAULT_CAPABILITY_PROFILE: StudentCapabilityProfile = {
  educationLevel: 'first_year',
  programmingExperience: 'beginner',
  fieldOfStudy: 'computer_science',
  careerInterests: ['Software Engineer'],
  weeklyHours: 5,
  focusAreas: ['Programming Fundamentals', 'Problem Solving'],
  onboardingCompleted: false,
};

export async function getStudentCapabilityProfile(userId: string): Promise<StudentCapabilityProfile> {
  const row = await one<{
    education_level: string;
    programming_experience: string;
    field_of_study: string;
    career_interests: unknown;
    weekly_hours: number;
    focus_areas: unknown;
    onboarding_completed: boolean;
    updated_at: string;
  }>(
    `select education_level, programming_experience, field_of_study, career_interests, weekly_hours, focus_areas, onboarding_completed, updated_at
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
    onboardingCompleted: Boolean(row.onboarding_completed),
    updatedAt: row.updated_at,
  };
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
    onboardingCompleted: profile.onboardingCompleted ?? true,
  };

  await db().query(
    `insert into student_capability_profiles (
       user_id, education_level, programming_experience, field_of_study,
       career_interests, weekly_hours, focus_areas, onboarding_completed, updated_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (user_id) do update set
       education_level = excluded.education_level,
       programming_experience = excluded.programming_experience,
       field_of_study = excluded.field_of_study,
       career_interests = excluded.career_interests,
       weekly_hours = excluded.weekly_hours,
       focus_areas = excluded.focus_areas,
       onboarding_completed = excluded.onboarding_completed,
       updated_at = now()`,
    [
      userId,
      updated.educationLevel,
      updated.programmingExperience,
      updated.fieldOfStudy,
      JSON.stringify(updated.careerInterests),
      updated.weeklyHours,
      JSON.stringify(updated.focusAreas),
      updated.onboardingCompleted,
    ]
  );

  return updated;
}
