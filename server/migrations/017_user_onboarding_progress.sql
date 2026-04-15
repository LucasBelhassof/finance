ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_progress JSONB NOT NULL DEFAULT '{"currentStep":0,"completedSteps":[],"skippedSteps":[],"dismissed":false}'::jsonb;

UPDATE users
SET onboarding_progress = CASE
  WHEN onboarding_completed_at IS NOT NULL THEN
    '{"currentStep":3,"completedSteps":["profile","account","due_dates","dashboard"],"skippedSteps":[],"dismissed":false}'::jsonb
  ELSE
    COALESCE(
      onboarding_progress,
      '{"currentStep":0,"completedSteps":[],"skippedSteps":[],"dismissed":false}'::jsonb
    )
END;
