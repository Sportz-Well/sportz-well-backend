const db = require('./db');

async function cleanDB() {
  try {
    console.log("Cleaning database...");

    await db.query(`DELETE FROM players;`);

    console.log("All players deleted successfully");

    process.exit(0);
  } catch (err) {
    console.error("Error cleaning DB:", err);
    process.exit(1);
  }
}

cleanDB();