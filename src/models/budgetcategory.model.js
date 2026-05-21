import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: ''
    },
    budget: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
    }
  },
  {
    timestamps: true
  }
);

const budgetCategory = mongoose.model('BudgetCategory', categorySchema);

export { budgetCategory };
