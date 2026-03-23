'use strict';

const db = require('./db');

async function seedDemoData() {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM assessment_sessions');
    await client.query('DELETE FROM players');

    const players = [
      'Aarav', 'Vihaan', 'Arjun', 'Sai', 'Krish',
      'Ishaan', 'Dev', 'Rohan', 'Aditya', 'Kabir'
    ];

    let playerIds = [];

    for (let name of players) {
      const res = await client.query(
        `INSERT INTO players (name, role, gender)
         VALUES ($1, 'Batsman', 'Male')
         RETURNING id`,
        [name]
      );
      playerIds.push(res.rows[0].id);
    }

    for (let id of playerIds) {
      await client.query(`
        INSERT INTO assessment_sessions 
        (user_id, quarterly_cycle, test_date, overall_score)
        VALUES 
        ($1, 'Q1', NOW(), 60 + random()*10),
        ($1, 'Q2', NOW(), 70 + random()*10),
        ($1, 'Q3', NOW(), 80 + random()*10)
      `, [id]);
    }

    await client.query('COMMIT');

    console.log('✅ DEMO DATA SEEDED');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
  }
}

seedDemoData();