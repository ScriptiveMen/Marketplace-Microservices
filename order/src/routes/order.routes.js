const express = require("express");
const createAuthMiddleware = require("../middlewares/auth.middleware");
const orderController = require("../controllers/order.controller");
const validation = require("../middlewares/validator.middleware");

const router = express.Router();

/* POST /api/orders/ */
router.post(
    "/",
    createAuthMiddleware(["user"]),
    validation.createOrderValidation,
    orderController.createOrder
);

/* GET /api/orders/me - Paginated list of the customer's order */
router.get("/me", createAuthMiddleware(["user"]), orderController.getMyOrders);

/* GET /api/orders/:id - Get order by id with timeline and payment summary */
router.get(
    "/:id",
    createAuthMiddleware(["user", "admin"]),
    orderController.getOrderById
);

/* POST /api/orders/:id/cancel - Buyer - initiated cancel while pending/ paid rules apply */
router.post(
    "/:id/cancel",
    createAuthMiddleware(["user"]),
    orderController.cancelOrderById
);

/* PATCH /api/orders/:id/address - update delivery address prior to payment capture. */
router.patch(
    "/:id/address",
    createAuthMiddleware(["user"]),
    validation.updateAddressValidation,
    orderController.updateOrderAddress
);

module.exports = router;
