-- SWPI Core Database Schema (MVP 1.1 - Edge Processing Update)

CREATE TABLE academies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    academy_id INT REFERENCES academies(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'superadmin', 'headcoach', 'asstcoach'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    academy_id INT REFERENCES academies(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    dob DATE,
    primary_role VARCHAR(100),
    parent_whatsapp VARCHAR(20),
    dpdp_consent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id),
    session_date DATE NOT NULL,
    status VARCHAR(10) DEFAULT 'Present'
);

CREATE TABLE weekly_assessments (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id),
    assessment_date DATE NOT NULL,
    fitness_score INT NOT NULL, -- Values: 4, 7, or 9
    skill_score INT NOT NULL,   -- Values: 4, 7, or 9
    mental_score INT NOT NULL   -- Values: 4, 7, or 9
);

CREATE TABLE match_logs (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id),
    match_date DATE NOT NULL,
    tournament_name VARCHAR(255),
    runs_scored INT DEFAULT 0,
    balls_faced INT DEFAULT 0,
    not_out BOOLEAN DEFAULT FALSE,
    overs_bowled DECIMAL(4,1) DEFAULT 0.0,
    wickets_taken INT DEFAULT 0,
    runs_conceded INT DEFAULT 0
);

-- NEW TABLE: Stores Edge-Processed Camera Data and Gemini AI Outputs
CREATE TABLE biomechanical_logs (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id),
    generated_by_user_id INT REFERENCES users(id), -- Tracks which Admin/Coach pressed generate
    assessment_date DATE NOT NULL,
    ai_persona VARCHAR(50) NOT NULL, -- e.g., 'The Master', 'The Magician'
    kinematic_data_json JSONB NOT NULL, -- Stores the raw browser-extracted angles
    ai_generated_report TEXT, -- Stores the automated Gemini text output
    status VARCHAR(20) DEFAULT 'Data_Captured', -- Changes to 'Report_Generated' to lock the UI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);