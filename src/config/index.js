const dotenv = require('dotenv');

// Load env vars based on NODE_ENV
dotenv.config();

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Add to config object:
jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'super_secret_access_key_change_me',
jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_key_change_me',
jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
// Cloudinary Config
cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,

// Pagination Config
defaultPageLimit: process.env.DEFAULT_PAGE_LIMIT || 10,
};

// Validate critical env vars
const checkMissingVars = () => {
  const required = ['mongoUri'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

checkMissingVars();


module.exports = config;