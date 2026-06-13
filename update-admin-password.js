const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const User = require('./src/models/User');

const updateAdminPassword = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // Find the admin user
    const admin = await User.findOne({ role: 'admin' });

    if (!admin) {
      console.log('❌ Admin user not found!');
      process.exit(1);
    }

    // Set the new secure password 
    // (The pre-save hook in User.js will automatically hash this for you!)
    admin.password = 'SkillBridge_Admin@2024!'; // <-- CHANGE THIS to your desired secure password

    await admin.save();

    console.log('✅ Admin password updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating password:', error);
    process.exit(1);
  }
};

updateAdminPassword();