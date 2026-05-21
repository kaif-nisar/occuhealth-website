import express from "express";
import { expense } from "../models/expense.model.js";// ya jahan schema export kiya ho

const addNewExpense = async (req, res) => {
  try {
    const {
      title,
      amount,
      date,
      category,
      notes,
      paymentMode   // ✅ Now included
    } = req.body;

    let userId
    if (req.user.role === 'staff') {
      userId = req.user.parentUser
    } else {
      userId = req.user._id
    }

    const newExpense = new expense({
      title,
      amount,
      date,
      category,
      notes,
      paymentMode,                 // ✅ Now saved
      createdBy: userId
    });

    const savedExpense = await newExpense.save();

    if (!savedExpense) {
      return res.status(400).json({
        success: false,
        message: 'Expense could not be saved'
      });
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          activities: {
            activityType: "other",
            details: {
              staffId: req.user._id,
              staffName: req.user.fullName,
              action: "Staff added a new expense",
              expenseId: savedExpense._id,
              expense: `Staff ${req.user.fullName} added a new expense of amount ${amount}`
            },
            reference: {
              model: "Expense",
              id: savedExpense._id
            },
            timestamp: new Date()
          }
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Expense saved successfully',
      data: savedExpense
    });
  } catch (error) {
    console.error('Error saving expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save expense',
      error: error.message
    });
  }
};
const fetchUserExpenses = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let userId;
    if (req.user.role === 'staff') {
      userId = req.user.parentUser
    } else {
      userId = req.user._id
    }
    // Build query object
    const query = {
      createdBy: userId
    }


    // If date range is provided, add it to query
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const expenses = await expense.find(query).sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: expenses
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses',
      error: error.message
    });
  }
};

const editExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;

    const {
      title,
      amount,
      date,
      category,
      notes,
      paymentMode
    } = req.body;

    // Validate fields if needed (optional)
    if (!title || !amount || !date || !category || !paymentMode) {
      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });
    }

    let userId;
    if (req.user.role === 'staff') {
      userId = req.user.parentUser
    } else {
      userId = req.user._id
    }

    // Find and update
    const updatedExpense = await expense.findOneAndUpdate(
      { _id: expenseId, createdBy: userId },  // Ensure only owner can edit
      {
        title,
        amount,
        date,
        category,
        notes,
        paymentMode
      },
      { new: true } // Return updated document
    );

    if (!updatedExpense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found or you do not have permission to edit."
      });
    }

     // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user.role === 'staff') {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          activities: {
            activityType: "other",
            details: {
              staffId: req.user._id,
              staffName: req.user.fullName,
              action: "Staff updated an expense",
              expenseId: updatedExpense._id,
              expense: `Staff ${req.user.fullName} updated an expense of amount ${amount}`
            },
            reference: {
              model: "Expense",
              id: updatedExpense._id
            },
            timestamp: new Date()
          }
        }
      });
    }

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: updatedExpense
    });
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update expense",
      error: error.message
    });
  }
};

export {
  addNewExpense,
  fetchUserExpenses,
  editExpense
};
