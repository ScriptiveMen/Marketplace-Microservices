const express = require("express");
const createAuthMiddleware = require("../middlewares/auth.middleware");
const paymentController = require("../controllers/payment.controller");

const router = express.Router();

/* POST /api/payments/create/:orderId - Create Payment */
router.post(
    "/create/:orderId",
    createAuthMiddleware(["user"]),
    paymentController.createPayment
);

/* /api/payments/verify - Verify the payment */
router.post(
    "/verify",
    createAuthMiddleware(["user"]),
    paymentController.verifyPayment
);

module.exports = router;
