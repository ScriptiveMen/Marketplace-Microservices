const express = require("express");
const validators = require("../middlewares/validator.middleware");
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// POST /api/auth/register
router.post(
  "/register",
  validators.registerUserValidations,
  authController.registerUser
);

// POST /api/auth/login
router.post(
  "/login",
  validators.loginUserValidations,
  authController.loginUser
);

// GET /api/auth/me
router.get("/me", authMiddleware.authMiddleware, authController.authMe);

// GET /api/auth/logout
router.get("/logout", authController.logoutUser);

// GET /api/auth/users/me/addresses - List, save addresses, mark default
router.get(
  "/users/me/addresses",
  authMiddleware.authMiddleware,
  authController.getUserAddresses
);

// POST /api/auth/users/me/addresses - Add addresses (with validation - pincode)
router.post(
  "/users/me/addresses",
  validators.addUserAddressValidation,
  authMiddleware.authMiddleware,
  authController.addUserAddresses
);

// DELETE /api/auth/users/me/addresses/:addressId - Remove addresses
router.delete(
  "/users/me/addresses/:addressId",
  authMiddleware.authMiddleware,
  authController.deleteUserAddress
);

module.exports = router;
