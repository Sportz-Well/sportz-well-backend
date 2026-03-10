require('dotenv').config();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const SCHOOL_ID = '40118e73-d45e-44ea-b93d-ec9778c94ff4';
const TOTAL_PLAYERS = 25;

function getQuarterDate(quarter) {
  switch (quarter) {
    case 1: return new Date('2025-05-15');
    case 2: return new Date('2025-08-15');
    case 3: return new Date('2025-11-15');
    case 4: return new Date('2026-02-15');
  }
}

function calculateImprovement(prev, current) {
  if (!prev) return 0;
  return Number((((current - prev) / prev) * 100).toFixed(2));
}

async function seed() {
  try {
    console.log("Clearing old demo data...");

    await pool.query("DELETE FROM assessment_sessions WHERE school_id = $1", [SCHOOL_ID]);
    await pool.query("DELETE FROM players WHERE school_id = $1", [SCHOOL_ID]);

    console.log("Creating demo players...");

    for (let i = 1; i <= TOTAL_PLAYERS; i++) {

      const playerId = uuidv4();

      await pool.query(
        `INSERT INTO players (id, name, gender, school_id)
         VALUES ($1, $2, $3, $4)`,
        [
          playerId,
          `Player ${i}`,
          i % 2 === 0 ? 'Male' : 'Female',
          SCHOOL_ID
        ]
      );

      let baseScore = 60 + Math.floor(Math.random() * 10);
      let previousScore = null;

      for (let q = 1; q <= 4; q++) {

        let overall;

        if (i <= 18) {
          overall = baseScore + (q * 5) + Math.floor(Math.random() * 3);
        } else if (i <= 21) {
          overall = baseScore + Math.floor(Math.random() * 2);
        } else if (i <= 23) {
          overall = baseScore - (q * 2);
        } else {
          overall = baseScore - 5 + (q * 4);
        }

        const improvement = calculateImprovement(previousScore, overall);

        await pool.query(
          `INSERT INTO assessment_sessions
           (id, user_id, school_id, physical_score, mental_score, skill_score, overall_score, improvement_pct, test_date, quarterly_cycle)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            uuidv4(),
            playerId,
            SCHOOL_ID,
            overall - 5,
            overall - 3,
            overall - 2,
            overall,
            improvement,
            getQuarterDate(q),
            `Q${q} 2025`
          ]
        );

        previousScore = overall;
      }
    }

    console.log("Demo data seeded successfully.");
    process.exit();

  } catch (err) {
    console.error("Error seeding data:", err);
    process.exit(1);
  }
}

seed();