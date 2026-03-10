const db = require('../db');

exports.getPlayers = async (req, res) => {
  try {
    const schoolId = req.user.school_id;

    const result = await db.query(
      `SELECT id, name, age, gender, role
       FROM players
       WHERE school_id = $1
       ORDER BY name ASC`,
      [schoolId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
};

exports.addPlayer = async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const { name, age, gender, role } = req.body;

    const result = await db.query(
      `INSERT INTO players (name, age, gender, role, school_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [name, age, gender, role, schoolId]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error adding player:', error);
    res.status(500).json({ error: 'Failed to add player' });
  }
};

exports.getPlayerById = async (req, res) => {
  try {
    const playerId = req.params.id;

    const result = await db.query(
      `SELECT * FROM players WHERE id = $1`,
      [playerId]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
};