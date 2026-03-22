-- Run this if school_id column doesn't exist or has wrong type

-- Add school_id to players table if missing
ALTER TABLE players ADD COLUMN IF NOT EXISTS school_id INTEGER DEFAULT 1;

-- Add school_id to assessment_sessions table if missing
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS school_id INTEGER DEFAULT 1;

-- Verify columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name IN ('players', 'assessment_sessions') 
  AND column_name = 'school_id'
ORDER BY table_name;
