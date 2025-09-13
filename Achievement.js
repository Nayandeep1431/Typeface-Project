const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  badgeId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  points: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['saving', 'spending', 'tracking', 'budget', 'streak', 'special'],
    default: 'tracking'
  },
  earnedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

achievementSchema.index({ userId: 1, badgeId: 1 }, { unique: true });
achievementSchema.index({ userId: 1, earnedAt: -1 });

module.exports = mongoose.model('Achievement', achievementSchema);
