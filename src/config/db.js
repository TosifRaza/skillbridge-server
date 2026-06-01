const mongoose = require('mongoose');
const config = require('./index');

const connectDB = async () => {
  try {
    // Set Mongoose Query Strictness
    mongoose.set('strictQuery', true);
// console.log('Mongo URI:', config.mongoUri);
    const conn = await mongoose.connect(config.mongoUri);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Handle runtime connection errors
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB runtime connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;