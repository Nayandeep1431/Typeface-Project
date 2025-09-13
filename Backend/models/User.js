const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  preferences: {
    defaultCurrency: {
      type: String,
      default: 'INR'
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    ocrPreference: {
      type: String,
      enum: ['tesseract', 'google-vision', 'auto'],
      default: 'auto'
    },
    autoCategorizationEnabled: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    totalUploads: {
      type: Number,
      default: 0
    },
    totalExpensesExtracted: {
      type: Number,
      default: 0
    },
    lastUpload: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update upload stats
userSchema.methods.updateUploadStats = async function(expensesCount) {
  this.stats.totalUploads += 1;
  this.stats.totalExpensesExtracted += expensesCount;
  this.stats.lastUpload = new Date();
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
