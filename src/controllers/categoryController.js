import { Counter, categorydb } from "../models/category.model.js";
import { SuperAdmin } from "../models/superAdmin.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose"

// superAdmin Function to add a new category 
const addCategory = async (req, res) => {

    const { category } = req.body;
    let userId;
     if(req.user.role === 'staff'){
        userId = req.user.parentUser
     }else{
        userId = req.user._id
     }

    try {

        const fetchedcategory = await categorydb.findOne({
            createdBy: userId,
            category: category
        });

        if (fetchedcategory) {
            return res.json({ message: `'${category}' allready present`, type: "error" });
        }


        if (!category && typeof category !== "string") {
            return res.json({ message: "please enter category Name", type: "auth" });
        }
        const lastPanel = await categorydb
            .findOne({ createdBy: req.user._id }) // optionally filter by tenant
            .sort({ orderId: -1 })             // highest order first
            .select('orderId');                // only fetch order field

        const nextOrder = lastPanel ? lastPanel.orderId + 1 : 1;        

        // Create a new category document
        const newCategory = new categorydb({
            orderId: nextOrder,
            category: category,
            tenantId: null,
            createdBy: userId,
            isBaseCategory: true,
            createdByRole: "superAdmin",
            purchasedFromBaseCategory: false,
            originalCategoryId: null
        });

        // Save the category to the database
        const savedCategory = await newCategory.save();

        if (!savedCategory) {
            return res.json({ message: "Connection error, please check your internet connection", type: "error" });
        }

         // अगर staff का parentUser है तो उसे भी notify करें
            if (req.user.role === 'staff') {
                await SuperAdmin.findByIdAndUpdate(req.user._id, {
                    $push: {
                        activities: {
                            activityType: "test_create",
                            details: {
                                staffId: req.user._id,
                                staffName: req.user.fullName,
                                action: "Staff created a new category",
                                categoryName: category,
                                categoryId: savedCategory._id
                            },
                            reference: {
                                model: "unit",
                                id: savedCategory._id
                            },
                            timestamp: new Date()
                        }
                    }
                });
            }

        return res.status(200).json({ message: `${category} added successfully:`, type: "success" });

    } catch (error) {
        console.error("Error adding category:", error.message);
    }
};
 // add category by admin
const addCategoryadmin = async (req, res) => {

    const { category } = req.body;

      let userId;
     if(req.user.role === 'staff'){
        userId = req.user.parentUser
     }else{
        userId = req.user._id
     }
    const tenantid = req.user.tenantId._id;
    try {

        const fetchedcategory = await categorydb.findOne({
            tenantId: tenantid,
            category: category
        });

        if (fetchedcategory) {
            return res.json({ message: `'${category}' allready present`, type: "error" });
        }


        if (!category && typeof category !== "string") {
            return res.json({ message: "please enter category Name", type: "auth" });
        }

        const lastPanel = await categorydb
            .findOne({ tenantId: tenantid }) // optionally filter by tenant
            .sort({ orderId: -1 })             // highest order first
            .select('orderId');                // only fetch order field

        const nextOrder = lastPanel ? lastPanel.orderId + 1 : 1;
        
        // Create a new category document
        const newCategory = new categorydb({
            orderId: nextOrder,
            category: category,
            tenantId: tenantid,
            createdBy: userId,
            isBaseCategory: true,
            createdByRole: "admin",
            purchasedFromBaseCategory: false,
            originalCategoryId: null
        });

        // Save the category to the database
        const savedCategory = await newCategory.save();

        if (!savedCategory) {
            return res.json({ message: "Connection error, please check your internet connection", type: "error" });
        }
                 // अगर staff का parentUser है तो उसे भी notify करें
            if (req.user.role === 'staff') {
                await User.findByIdAndUpdate(req.user._id, {
                    $push: {
                        activities: {
                            activityType: "test_create",
                            details: {
                                staffId: req.user._id,
                                staffName: req.user.fullName,
                                action: "Staff created a new category",
                                categoryName: category,
                                categoryId: savedCategory._id
                            },
                            reference: {
                                model: "unit",
                                id: savedCategory._id
                            },
                            timestamp: new Date()
                        }
                    }
                });
            }

        return res.status(200).json({ message: `${category} added successfully:`, type: "success" });

    } catch (error) {
        console.error("Error adding category:", error.message);
    }
};

// Function to fetch all categories
const fetchCategories = async (req, res) => {
    try {
        // Retrieve all categories from the database, sorted by orderId
        const categories = await categorydb.find({
            createdBy: req.user._id,
        }).sort({ orderId: 1 });

        if (!categories) {
            return res.json({ message: "categories not found" });
        }

        // Send the categories as a JSON response
        return res.json({
            message: "Categories fetched successfully",
            categories: categories
        });

    } catch (error) {
        console.error("Error fetching categories:", error.message);
        return res.status(500).json({ error: "An error occurred while fetching categories." });
    }
};
const fetchCategoriesadmin = async (req, res) => {
    try {
        // Retrieve all categories from the database, sorted by orderId
        const categories = await categorydb.find({
            tenantId: req.user.tenantId._id,
            createdBy: req.user._id
        }).sort({ orderId: 1 });

        if (!categories) {
            return res.json({ message: "categories not found" });
        }

        // Send the categories as a JSON response
        return res.json({
            message: "Categories fetched successfully",
            categories: categories
        });

    } catch (error) {
        console.error("Error fetching categories:", error.message);
        return res.status(500).json({ error: "An error occurred while fetching categories." });
    }
};

const updatecategoryOrder = async (req, res) => {
    const { updatedOrder } = req.body;
    const tid = req.user.tenantId._id;

    if (!Array.isArray(updatedOrder) || updatedOrder.length === 0) {
        return res.status(400).json({ message: "Invalid or empty order data" });
    }

    try {
        // Step 1: Fetch all categories and map orderId to _id
        const categories = await categorydb.find({
            tenantId: tid
        });
        const categoryMap = new Map();
        categories.forEach((category) => {
            categoryMap.set(category.orderId, category._id.toString());
        });

        // Step 2: Use a temporary orderId to avoid duplicates
        for (let i = 0; i < updatedOrder.length; i++) {
            const { id: oldOrderId, orderId: newOrderId } = updatedOrder[i];

            // Resolve _id using oldOrderId
            const resolvedId = categoryMap.get(Number(oldOrderId));
            if (!resolvedId) {
                throw new Error(`Category with orderId ${oldOrderId} not found`);
            }

            // Temporarily set a unique orderId
            await categorydb.updateOne(
                { _id: new mongoose.Types.ObjectId(resolvedId) },
                { $set: { orderId: -1 * (i + 1) } } // Negative temporary orderId
            );
        }

        // Step 3: Apply the final new orderId
        for (let i = 0; i < updatedOrder.length; i++) {
            const { id: oldOrderId, orderId: newOrderId } = updatedOrder[i];

            // Resolve _id using oldOrderId
            const resolvedId = categoryMap.get(Number(oldOrderId));
            if (!resolvedId) {
                throw new Error(`Category with orderId ${oldOrderId} not found`);
            }

            // Set the final orderId
            await categorydb.updateOne(
                { _id: new mongoose.Types.ObjectId(resolvedId) },
                { $set: { orderId: newOrderId } }
            );
        }

        res.status(200).json({
            status: 200,
            message: "Category order updated successfully",
        });
    } catch (error) {
        console.error("Error updating category order:", error.message);

        res.status(500).json({
            message: error.message || "Failed to update category order",
        });
    }
};
const updatecategoryOrdersuper = async (req, res) => {
    
    const { updatedOrder } = req.body;
    let userId;
     if(req.user.role === 'staff'){
        userId = req.user.parentUser
     }else{
        userId = req.user._id
     }

    if (!Array.isArray(updatedOrder) || updatedOrder.length === 0) {
        return res.status(400).json({ message: "Invalid or empty order data" });
    }

    try {
        // Step 1: Fetch all categories and map orderId to _id
        const categories = await categorydb.find({
            createdBy: userId
        });
        const categoryMap = new Map();
        categories.forEach((category) => {
            categoryMap.set(category.orderId, category._id.toString());
        });

        // Step 2: Use a temporary orderId to avoid duplicates
        for (let i = 0; i < updatedOrder.length; i++) {
            const { id: oldOrderId, orderId: newOrderId } = updatedOrder[i];

            // Resolve _id using oldOrderId
            const resolvedId = categoryMap.get(Number(oldOrderId));
            if (!resolvedId) {
                throw new Error(`Category with orderId ${oldOrderId} not found`);
            }

            // Temporarily set a unique orderId
            await categorydb.updateOne(
                { _id: new mongoose.Types.ObjectId(resolvedId) },
                { $set: { orderId: -1 * (i + 1) } } // Negative temporary orderId
            );
        }

        // Step 3: Apply the final new orderId
        for (let i = 0; i < updatedOrder.length; i++) {
            const { id: oldOrderId, orderId: newOrderId } = updatedOrder[i];

            // Resolve _id using oldOrderId
            const resolvedId = categoryMap.get(Number(oldOrderId));
            if (!resolvedId) {
                throw new Error(`Category with orderId ${oldOrderId} not found`);
            }

            // Set the final orderId
            await categorydb.updateOne(
                { _id: new mongoose.Types.ObjectId(resolvedId) },
                { $set: { orderId: newOrderId } }
            );
        }

        res.status(200).json({
            status: 200,
            message: "Category order updated successfully",
        });
    } catch (error) {
        console.error("Error updating category order:", error.message);

        res.status(500).json({
            message: error.message || "Failed to update category order",
        });
    }
};

const categoryById = async (req, res) => {
    try {
        const { category } = req.body;

        const categoryDocument = await categorydb.findOne({ category: category });

        if (!categoryDocument) {
            return res.json({ message: "Category not found" });
        }
        
        res.status(200).json(categoryDocument);
    } catch (error) {
        console.log(error)
    }
}

export {

    addCategory,
    fetchCategories,
    updatecategoryOrder,
    updatecategoryOrdersuper,
    categoryById,
    fetchCategoriesadmin,
    addCategoryadmin
}