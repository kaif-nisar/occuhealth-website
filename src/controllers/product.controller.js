import { Product } from '../models/product.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js'; // Tumhara file
import mongoose from 'mongoose'; // make sure this is imported at the top

const createProduct = async (req, res) => {
  try {
    const {
      name,
      skuId,
      description,
      category,
      status,
      price,
      discountPrice,
      stock,
      weight,
      dimensionLength,
      dimensionWidth,
      dimensionHeight,
      dimensionUnit,
      taxrate
    } = req.body;

    // ✅ Validate required fields
    if (!name || !skuId || !price || !stock) {
      return res.status(400).json({ success: false, message: "Please fill all required fields." });
    }

    // 🔢 Validate numbers
    const formattedPrice = Number(price);
    const formattedDiscount = discountPrice ? Number(discountPrice) : 0;
    const formattedStock = Number(stock);
    const formattedWeight = Number(weight);

    if (isNaN(formattedPrice) || isNaN(formattedStock)) {
      return res.status(400).json({ success: false, message: "Price, stock, and weight must be valid numbers." });
    }

    if (formattedDiscount > formattedPrice) {
      return res.status(400).json({ success: false, message: "Discount price cannot be greater than original price." });
    }

    // ✅ Validate image files from multer
    const mainImageFile = req.files?.mainImage?.[0];
    const additionalImageFiles = req.files?.additionalImages || [];

    if (!mainImageFile) {
      return res.status(400).json({ success: false, message: "Main image is required." });
    }

    if (additionalImageFiles.length > 5) {
      return res.status(400).json({ success: false, message: "Only up to 5 additional images are allowed." });
    }

    // 📤 Upload main image to Cloudinary
    const uploadedMainImage = await uploadOnCloudinary(mainImageFile.path);

    // 📤 Upload additional images to Cloudinary
    const uploadedAdditionalImages = [];
    for (const file of additionalImageFiles) {
      const result = await uploadOnCloudinary(file.path);
      uploadedAdditionalImages.push({
        url: result.secure_url,
        public_id: result.public_id
      });
    }

    // 📦 Create and Save Product
    const newProduct = new Product({
      name,
      skuId: skuId.toUpperCase(),
      description,
      category,
      status,
      price: formattedPrice,
      discountPrice: formattedDiscount,
      stock: formattedStock,
      weight: formattedWeight,
      dimensions: {
        length: Number(dimensionLength),
        width: Number(dimensionWidth),
        height: Number(dimensionHeight),
        unit: dimensionUnit || "cm"
      },
      mainImage: {
        url: uploadedMainImage.secure_url,
        public_id: uploadedMainImage.public_id
      },
      additionalImages: uploadedAdditionalImages,
      createdBy: req.user.role === "staff" ? req.user.parentUser._id : req.user._id, // Optional: if auth used
      tenantId: req.user.tenantId._id,
      taxrate: taxrate
    });

    const savedProduct = await newProduct.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: savedProduct,
    });

  } catch (error) {
    console.error("Error while creating product:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating product",
    });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const tenantId = req.user.tenantId._id;

    let admin = (req.user.role === "admin");
    let products;

    if (admin) {
      products = await Product.find({
        tenantId: tenantId,
      }).sort({ createdAt: -1 });
    } else {
      products = await Product.find({
        tenantId: tenantId,
        status: "Active"
      }).sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: products
    });

  } catch (error) {
    console.error("Error while fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products"
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
     let userId;
    if(req.user.role === 'staff'){
        userId = req.user.parentUser._id
    }else{
        userId = req.user._id
    }
    const tenantId = req.user.tenantId._id;

    // ✅ Check if ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    const {
      name,
      skuId,
      category,
      price,
      status,
      discountPrice,
      stock
    } = req.body;

    // ✅ Basic required fields validation
    if (!name || !skuId || isNaN(price) || isNaN(stock)) {
      return res.status(400).json({
        success: false,
        message: "Invalid input. Please provide name, SKU, price, and stock."
      });
    }

    const formattedPrice = Number(price);
    const formattedStock = Number(stock);
    const formattedDiscountPrice = discountPrice ? Number(discountPrice) : 0;

    // ✅ Validation: Discount must not exceed price
    if (formattedDiscountPrice > formattedPrice) {
      return res.status(400).json({
        success: false,
        message: "Discount price cannot be greater than the original price."
      });
    }

    const updatedData = {
      name,
      skuId: skuId.toUpperCase(),
      category,
      status,
      price: formattedPrice,
      stock: formattedStock,
      discountPrice: formattedDiscountPrice,
      updatedAt: new Date()
    };

      console.log("id:", id);
      console.log("userId:", userId);
      console.log("tenantId:", tenantId);

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, createdBy: userId, tenantId },
      updatedData,
      { new: true }
    );

    console.log("Updated Product:", updatedProduct);

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found or not authorized."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct
    });

  } catch (error) {
    console.error("Update error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating product"
    });
  }
};

const getLatestProduct = async (req, res) => {
  try {
    const tenantId = req.user.tenantId._id;

    const latestProduct = await Product.findOne({
      tenantId: tenantId,
      status: "Active",
      stock: {$gt:0}
    }).sort({ createdAt: -1 });

    if (!latestProduct) {
      return res.status(404).json({
        success: false,
        message: "No product found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Latest product fetched successfully",
      data: latestProduct
    });

  } catch (error) {
    console.error("Error while fetching latest product:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching latest product"
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const tenantId = req.user.tenantId._id;
    const productId = req.params.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    const product = await Product.findOne({
      _id: productId,
      tenantId: tenantId
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product
    });

  } catch (error) {
    console.error("Error while fetching product by ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product by ID"
    });
  }
};


export {
  createProduct,
  getAllProducts,
  updateProduct,
  getLatestProduct,
  getProductById
}

