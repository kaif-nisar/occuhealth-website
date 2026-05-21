import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: ''
    },
    amount: {
      type: Number,
      default: 0
    },
    date: {
      type: Date,
      default: Date.now
    },
    category: {
      type: String,
      default: 'General'
    },
    notes: {
      type: String,
      default: ''
    },
    paymentMode: {           // ✅ Added field
      type: String,
      default: 'Cash'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
    }
  },
  {
    timestamps: true
  }
);

const expense = mongoose.model('Expense', expenseSchema);

export { expense };
