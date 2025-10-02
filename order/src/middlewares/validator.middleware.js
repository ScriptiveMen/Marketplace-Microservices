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

const createOrderValidation = [
    body("shippingAddress.street")
        .isString()
        .withMessage("Street must be a string")
        .notEmpty()
        .withMessage("Street is required"),

    body("shippingAddress.city")
        .isString()
        .withMessage("City must be a string")
        .notEmpty()
        .withMessage("City is required"),

    body("shippingAddress.state")
        .isString()
        .withMessage("State must be a string")
        .notEmpty()
        .withMessage("State is required"),
    body("shippingAddress.country")
        .isString()
        .withMessage("Country must be a string")
        .notEmpty()
        .withMessage("Country is required"),
    body("shippingAddress.pincode")
        .isString()
        .withMessage("Pincode must be a string")
        .notEmpty()
        .withMessage("Pincode is required")
        .bail()
        .matches(/^\d{6}$/) // Exactly 6 digits for Indian pincode
        .withMessage("Pincode must be exactly 6 digits"),

    respondWithValidationErrors,
];

const updateAddressValidation = [
    body("shippingAddress.street")
        .isString()
        .withMessage("Street must be a string")
        .notEmpty()
        .withMessage("Street is required"),

    body("shippingAddress.city")
        .isString()
        .withMessage("City must be a string")
        .notEmpty()
        .withMessage("City is required"),

    body("shippingAddress.state")
        .isString()
        .withMessage("State must be a string")
        .notEmpty()
        .withMessage("State is required"),
    body("shippingAddress.country")
        .isString()
        .withMessage("Country must be a string")
        .notEmpty()
        .withMessage("Country is required"),
    body("shippingAddress.pincode")
        .isString()
        .withMessage("Pincode must be a string")
        .notEmpty()
        .withMessage("Pincode is required")
        .bail()
        .matches(/^\d{6}$/) // Exactly 6 digits for Indian pincode
        .withMessage("Pincode must be exactly 6 digits"),

    respondWithValidationErrors,
];

module.exports = {
    createOrderValidation,
    updateAddressValidation,
};
