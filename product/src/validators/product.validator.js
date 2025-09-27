const { body, validationResult } = require("express-validator");

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: "Validation errors",
            errors: errors.array(), // Added .array() for better error format
        });
    }
    next();
}

const createProductValidators = [
    body("title").isString().trim().notEmpty().withMessage("Title is required"),
    body("description")
        .optional()
        .isString()
        .withMessage("Description must be a string")
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description max length is 500 characters"),
    body("priceAmount")
        .notEmpty()
        .withMessage("price amount is required")
        .bail()
        .isFloat({ gt: 0 })
        .withMessage("price amount must be a positive number"),
    body("priceCurrency")
        .optional()
        .isIn(["USD", "INR"])
        .withMessage("price Currency must be USD or INR"),
    handleValidationErrors,
];

module.exports = { createProductValidators };
