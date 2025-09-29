const { body, validationResult, param } = require("express-validator");
const mongoose = require("mongoose");

function validateResult(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    next();
}

const validateAddItemCart = [
    body("productId")
        .isString()
        .withMessage("Product id must be a string")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("invalid Product Id format"),

    body("qty")
        .isInt({ gt: 0 })
        .withMessage("Quantity must be a positive integer"),

    validateResult,
];

const validateUpdateItemCart = [
    param("productId")
        .isString()
        .withMessage("Product id must be a string")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("invalid Product Id format"),

    body("qty")
        .isInt({ gt: 0 })
        .withMessage("Quantity must be a positive integer"),

    validateResult,
];

module.exports = { validateAddItemCart, validateUpdateItemCart };
