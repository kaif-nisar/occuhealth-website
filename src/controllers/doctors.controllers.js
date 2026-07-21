import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { doctors } from "../models/doctor.model.js";
import { User } from "../models/user.model.js";
const addDoctorsController = asyncHandler(async (req, res) => {
  const { firstname, lastname, specialization, dob, gender, address, remarks } = req.body;
  if (!(firstname && lastname && specialization && dob && gender)) {
    throw new ApiError(500, "all fields are required");
  }

  let userId;
  if (req.user.role === 'staff') {
    userId = req.user.parentUser;
  } else {
    userId = req.user._id;
  }

  const createdDoctor = await doctors.create({
    firstName: firstname,
    lastName: lastname,
    specialization: specialization,
    DOB: dob,
    gender,
    address,
    remarks,
    createdBy: userId,
    tenantId: req.user.tenantId, // Make sure tenantId is provided in req.body
  });

  if (!createdDoctor) {
    throw new ApiError(400, "something went wrong while creating doctor");
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
                action: "Staff added a new doctor",
                doctorId: createdDoctor._id,
                doctor: createdDoctor.firstName + ' ' + createdDoctor.lastName
              },
              reference: {
                model: "Doctor",
                id: createdDoctor._id
              },
              timestamp: new Date()
            }
          }
        });
      }

  return res.json(new ApiResponse(200, "doctor created successfully"));
});

const allDoctorsController = asyncHandler(async (req, res) => {
  // If allInTenant=true, return ALL doctors in the tenant (for full-ledger dropdowns etc.)
  if (req.query.allInTenant === 'true') {
    const tenantId = req.query.tenantId || req.user.tenantId;
    const allDoctors = await doctors.find({ tenantId: tenantId }).sort({ createdAt: -1 });
    return res.json(allDoctors);
  }

  let userId;
  // Allow query param override for franchisee-specific doctor lookup
  if (req.query.forUserId) {
    userId = req.query.forUserId;
  } else if(req.user.role === 'staff'){
    userId = req.user.parentUser
  } else {
    userId = req.user._id
  }
  if (!userId) {
    throw new ApiError(400, "userId is required");
  }
  // Also filter by tenantId if provided, otherwise use req.user.tenantId
  const tenantId = req.query.tenantId || req.user.tenantId;
  const query = { createdBy: userId, tenantId: tenantId };
  const allDoctors = await doctors
    .find(query)
    .sort({ createdAt: -1 });
  if (!allDoctors) {
    throw new ApiError(400, "something went wrong while fetching doctors");
  }
  return res.json(allDoctors);
});

// fetch one doctor by ID
const getDoctorById = asyncHandler(async (req, res) => {

  const doctorId = req.params.doctorId || req.query;
  console.log("Doctor ID:", doctorId);
  if (!doctorId) {
    throw new ApiError(400, "doctorId is required");
  }
  const doctor = await doctors.findById(doctorId);
  if (!doctor) {
    throw new ApiError(404, "doctor not found");
  }
  console.log("Doctor found:", doctor);
    return res.json(new ApiResponse(200, doctor, "Doctor fetched successfully"));
});

// Update doctor controller
const updateDoctorController = asyncHandler(async (req, res) => {
  const {
    doctorId,
    firstname,
    lastname,
    specialization,
    dob,
    gender,
    address,
    remarks,
  } = req.body;
  if (
    !(doctorId && (firstname || lastname || specialization || dob || gender))
  ) {
    throw new ApiError(500, "all fields are required");
  }
  const updatedDoctor = await doctors.findByIdAndUpdate(
    doctorId,
    {
      ...(firstname && { firstName: firstname }),
      ...(lastname && { lastName: lastname }),
      ...(specialization && { specialization }),
      ...(dob && { DOB: dob }),
      ...(gender && { gender }),
      ...(remarks && { remarks }),
      ...(address && { address }),
    },
    { new: true }
  );
  if (!updatedDoctor) {
    throw new ApiError(400, "Doctor not found or update failed");
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
                action: "Staff updated a doctor",
                doctorId: updatedDoctor._id,
                doctor: updatedDoctor.firstName + ' ' + updatedDoctor.lastName
              },
              reference: {
                model: "Doctor",
                id: updatedDoctor._id
              },
              timestamp: new Date()
            }
          }
        });
      }

  
  return res.json(
    new ApiResponse(200, "Doctor updated successfully", updatedDoctor)
  );
});

// Delete doctor controller
const deleteDoctorController = asyncHandler(async (req, res) => {
  const { doctorId } = req.body;
  if (!doctorId) {
    throw new ApiError(400, "doctorId is required");
  }
  const deletedDoctor = await doctors.findByIdAndDelete(doctorId);
  if (!deletedDoctor) {
    throw new ApiError(404, "Doctor not found or already deleted");
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
                action: "Staff deleted a doctor",
                doctorId: deletedDoctor._id,
                doctor: deletedDoctor.firstName + ' ' + deletedDoctor.lastName
              },
              reference: {
                model: "Doctor",
                id: deletedDoctor._id
              },
              timestamp: new Date()
            }
          }
        });
      }

  return res.json(new ApiResponse(200, "Doctor deleted successfully"));
});

export {
  addDoctorsController,
  allDoctorsController,
  updateDoctorController,
  deleteDoctorController,
  getDoctorById
};
