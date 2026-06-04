const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false, // Never include in queries unless explicitly requested
  },
  role: {
    type: String,
    enum: ['customer', 'provider', 'admin'],
    default: 'customer',
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  refreshToken: {
    type: String,
    select: false, // Sensitive: hide from queries
  },
    // Add these fields inside the userSchema definition:
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  totalReviews: {
    type: Number,
    default: 0,
    min: 0,
  },
    // Add these fields inside the userSchema definition:
  isBlocked: {
    type: Boolean,
    default: false,
  },
  verificationStatus: {
    type: String,
    enum: ['None', 'Pending', 'Verified', 'Rejected'],
    default: 'None', // Workers will update this to 'Pending' when they upload IDs
  },

    fullName: {
    type: String,
    trim: true,
    default: '',
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  avatar: {
    url: { type: String, default: '' },
    public_id: { type: String, default: '' },
  },
  addresses: [{
    street: { type: String, required: true },
    city: { type: String, required: true },
    zip: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  }],
  paymentMethods: [{
    cardBrand: { type: String, required: true }, // e.g., Visa
    last4: { type: String, required: true },     // e.g., 4242
    isDefault: { type: Boolean, default: false },
  }],
}, { timestamps: true });

// Hash password before saving
// Hash password before saving
userSchema.pre('save', async function () {
  // If password wasn't modified, skip the hashing
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);