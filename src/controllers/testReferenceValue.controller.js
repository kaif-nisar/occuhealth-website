import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { TestReferenceValue } from "../models/testReferenceValue.model.js";

const resolveTenantId = (user) => {
  if (!user) return null;
  // Staff should act on behalf of their parent admin
  if (user.role === "staff" && user.parentUser) return user.parentUser;
  // Admins carry tenantId._id; fallback to own _id
  if (user.tenantId && user.tenantId._id) return user.tenantId._id;
  return user._id || null;
};

const listReferenceValues = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req.user);

  if (!tenantId) {
    throw new ApiError(400, "tenant information is required");
  }

  const values = await TestReferenceValue.find({ tenantId }).sort({ createdAt: 1 });

  return res.status(200).json(new ApiResponse(200, values, "Reference values fetched"));
});

const createReferenceValue = asyncHandler(async (req, res) => {
  const { testId = null, parameterId = null, valueName, isAbnormal = false } = req.body;
  const tenantId = resolveTenantId(req.user);

  if (!valueName) {
    throw new ApiError(400, "valueName is required");
  }

  const trimmedName = valueName.trim();

  const record = await TestReferenceValue.findOneAndUpdate(
    {
      tenantId,
      valueName: trimmedName,
    },
    {
      $set: {
        testId,
        parameterId,
        isAbnormal: Boolean(isAbnormal),
        updatedBy: req.user?._id || null,
      },
      $setOnInsert: {
        createdBy: req.user?._id || null,
      },
    },
    {
      new: true,
      upsert: true,
    }
  );

  return res
    .status(201)
    .json(new ApiResponse(201, record, "Reference value saved successfully"));
});

const updateReferenceValue = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { valueName, isAbnormal } = req.body;
  const tenantId = resolveTenantId(req.user);

  if (!id) {
    throw new ApiError(400, "id is required");
  }

  const update = {
    updatedBy: req.user?._id || null,
  };

  if (typeof valueName === "string") {
    update.valueName = valueName.trim();
  }

  if (typeof isAbnormal === "boolean") {
    update.isAbnormal = isAbnormal;
  }

  const record = await TestReferenceValue.findOneAndUpdate(
    { _id: id, tenantId },
    { $set: update },
    { new: true }
  );

  if (!record) {
    throw new ApiError(404, "Reference value not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, record, "Reference value updated"));
});

const deleteReferenceValue = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = resolveTenantId(req.user);

  if (!id) {
    throw new ApiError(400, "id is required");
  }

  const deleted = await TestReferenceValue.findOneAndDelete({
    _id: id,
    tenantId,
  });

  if (!deleted) {
    throw new ApiError(404, "Reference value not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, deleted, "Reference value deleted"));
});

export {
  listReferenceValues,
  createReferenceValue,
  updateReferenceValue,
  deleteReferenceValue,
};
