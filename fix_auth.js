const bcrypt = require('bcrypt');
const db = require('./db');

async function fix() {
  const hash = await bcrypt.hash('admin123', 10);
  await db.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'admin@sportzwell.com']);
  console.log('Admin password hashed successfully');
  process.exit(0);
}

fix().catch(err => {
  console.error(err);
  process.exit(1);
});
