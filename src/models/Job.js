const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    trim: true,
    maxlength: 2000,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      // Phase 1
      'House Cleaning', 'Moving Helper', 'Loading/Unloading', 'Gardening', 'Event Helper',
      // Phase 2
      'Electrician', 'Plumber', 'Carpenter', 'Painter', 'TV Repair', 'AC Repair',
      // Phase 3
      'Web Development', 'Graphic Design', 'Video Editing', 'Content Writing', 'Data Entry'
    ],
  },
  budget: {
    type: Number,
    required: [true, 'Budget is required'],
    min: [0, 'Budget cannot be negative'],
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required'],
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
    },
    address: {
      type: String,
      trim: true,
    }
  },
  images: [{
    url: String,
    public_id: String,
  }],
  status: {
    type: String,
    enum: ['Open', 'Assigned', 'In-Progress', 'Completed', 'Cancelled', 'Closed'],
    default: 'Open',
  },
  // ADDED: Service Type for Hybrid Model
  serviceType: {
    type: String,
    enum: ['local', 'digital'],
    default: 'local',
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // hiredProvider will be added in Application Module
}, { timestamps: true });

// Create a text index for search functionality
jobSchema.index({ title: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Job', jobSchema);