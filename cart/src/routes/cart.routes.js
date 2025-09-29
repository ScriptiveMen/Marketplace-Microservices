const express = require("express");
const createAuthMiddleware = require("../middlewares/auth.middleware");
const cartController = require("../controllers/cart.controller");
const validation = require("../validators/validation.middleware");

const router = express.Router();

/* GET /api/cart */
router.get("/", createAuthMiddleware(["user"]), cartController.getCart);

/* POST /api/cart/items */
router.post(
    "/items",
    validation.validateAddItemCart,
    createAuthMiddleware(["user"]),
    cartController.addItemToCart
);

/* PATCH /api/cart/items/:productId */
router.patch(
    "/items/:productId",
    validation.validateUpdateItemCart,
    createAuthMiddleware(["user"]),
    cartController.updateItemQuantity
);

/* DELETE /api/items/:productId - Remove line */
/* DELETE /api/cart - Clears cart */

module.exports = router;
