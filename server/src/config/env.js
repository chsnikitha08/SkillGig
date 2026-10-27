const required = ['MONGODB_URI', 'JWT_SECRET'];

const isTest = process.env.NODE_ENV === 'test';

if (!isTest) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest,
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5050,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || (isTest ? 'test-secret' : undefined),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
