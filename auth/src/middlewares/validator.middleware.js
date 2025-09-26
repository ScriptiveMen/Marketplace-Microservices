const { body, validationResult } = require("express-validator");

const respondWithValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Get the first error message for consistency with tests
    const firstError = errors.array()[0];
    return res.status(400).json({
      message: firstError.msg,
      errors: errors.array(), // Keep the full errors array for debugging
    });
  }
  next();
};

const registerUserValidations = [
  body("username")
    .isString()
    .withMessage("Username must be String")
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters long"),

  body("email").isEmail().withMessage("Invalid email address"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be 6 characters long"),

  body("fullName.firstName")
    .isString()
    .withMessage("First Name must be a string")
    .notEmpty()
    .withMessage("First Name is required!"),

  body("fullName.lastName")
    .isString()
    .withMessage("Last Name must be a string")
    .notEmpty()
    .withMessage("Last Name is required"),

  body("role")
    .optional()
    .isIn(["user", "seller"])
    .withMessage("Role must be either user or seller"),

  respondWithValidationErrors,
];

const loginUserValidations = [
  body("username")
    .optional()
    .isString()
    .withMessage("Username must be a string"),
  body("email").optional().isEmail().withMessage("Invalid email address"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password should be 6 characters long"),
  body().custom((_, { req }) => {
    if (!req.body.username && !req.body.email) {
      throw new Error("Either username or email is required");
    }
    return true;
  }),
  respondWithValidationErrors,
];

const addUserAddressValidation = [
  body("street")
    .isString()
    .withMessage("Street must be a string")
    .notEmpty()
    .withMessage("Street is required"),

  body("city")
    .isString()
    .withMessage("City must be a string")
    .notEmpty()
    .withMessage("City is required"),

  body("state")
    .isString()
    .withMessage("State must be a string")
    .notEmpty()
    .withMessage("State is required"),
  body("country")
    .isString()
    .withMessage("Country must be a string")
    .notEmpty()
    .withMessage("Country is required"),
  body("pincode")
    .isString()
    .withMessage("Pincode must be a string")
    .notEmpty()
    .withMessage("Pincode is required")
    .bail()
    .matches(/^\d{6}$/) // Exactly 6 digits for Indian pincode
    .withMessage("Pincode must be exactly 6 digits"),

  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be a boolean"),

  respondWithValidationErrors,
];

module.exports = {
  registerUserValidations,
  loginUserValidations,
  addUserAddressValidation,
};
