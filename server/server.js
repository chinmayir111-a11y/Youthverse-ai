require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Fail loudly at boot rather than 500-ing on the first login attempt.
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy server/.env.example to server/.env and fill it in.');
  process.exit(1);
}

if (process.env.JWT_SECRET === 'change-me') {
  console.error('JWT_SECRET is still the placeholder value. Set a real secret in server/.env.');
  process.exit(1);
}

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`YouthVerse API listening on http://localhost:${PORT}`);
    console.log(`AI provider: ${process.env.AI_PROVIDER || 'mock'}`);
  });
};

start();
