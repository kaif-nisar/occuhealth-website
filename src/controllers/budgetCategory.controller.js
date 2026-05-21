import { budgetCategory } from '../models/budgetcategory.model.js';
import mongoose from 'mongoose';
// POST: Add New Category
const addNewCategory = async (req, res) => {
  try {
    const { name, budget } = req.body;

    console.log("req.user", req.user);

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    if (!budget || budget <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Budget must be greater than 0'
      });
    }

    const newCategory = new budgetCategory({
      name: name.trim(),
      budget,
      createdBy: req.user.role === "staff"? req.user.parentUser._id : req.user._id
    });

    const savedCategory = await newCategory.save();

    res.status(201).json({
      success: true,
      message: 'Category saved successfully',
      data: savedCategory
    });
  } catch (error) {
    console.error('Error saving category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save category',
      error: error.message
    });
  }
};

// GET: Get All Categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await budgetCategory.find({
      createdBy: req.user.role === "staff"? req.user.parentUser._id : req.user._id
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

// PUT: Update Category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, budget } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    if (!budget || budget <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Budget must be greater than 0'
      });
    }

    // Check if category exists and belongs to user
    const existingCategory = await budgetCategory.findOne({
      _id: id,
      createdBy: req.user.role === "staff"? req.user.parentUser._id : req.user._id
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const updatedCategory = await budgetCategory.findByIdAndUpdate(
      id,
      { 
        name: name.trim(), 
        budget 
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    console.error('Error updating category:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
};

// DELETE: Delete Category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category exists and belongs to user
    const existingCategory = await budgetCategory.findOne({
      _id: id,
      createdBy: req.user.role === "staff"? req.user.parentUser._id : req.user._id
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const deletedCategory = await budgetCategory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
      data: deletedCategory
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
};

// GET: Search Categories
const searchCategories = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const categories = await budgetCategory.find({
      createdBy: req.user._id,
      name: { $regex: query.trim(), $options: 'i' }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error searching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search categories',
      error: error.message
    });
  }
};

// GET: Get Category Statistics
const getCategoryStats = async (req, res) => {
  try {
    const totalCategories = await budgetCategory.countDocuments({
      createdBy: req.user._id
    });

    const totalBudgetResult = await budgetCategory.aggregate([
      {
        $match: {
          createdBy: new mongoose.Types.ObjectId(req.user._id)
        }
      },
      {
        $group: {
          _id: null,
          totalBudget: { $sum: '$budget' }
        }
      }
    ]);

    const totalBudget = totalBudgetResult.length > 0 ? totalBudgetResult[0].totalBudget : 0;

    res.status(200).json({
      success: true,
      data: {
        totalCategories,
        totalBudget
      }
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category statistics',
      error: error.message
    });
  }
};

// GET: Get Single Category by ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await budgetCategory.findOne({
      _id: id,
      createdBy: req.user.role === "staff"? req.user.parentUser._id : req.user._id
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
};

export { 
  addNewCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
  searchCategories,
  getCategoryStats,
  getCategoryById
};