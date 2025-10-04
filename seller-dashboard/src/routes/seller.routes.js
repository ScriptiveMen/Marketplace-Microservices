const express = require("express");
const createAuthMiddleware = require("../middlewares/auth.middleware");
const sellerControllers = require("../controllers/seller.controller");

const router = express.Router();

/* GET /api/seller/dashboard/metrics - Sales, revenue, top products */
router.get(
    "/metrics",
    createAuthMiddleware(["seller"]),
    sellerControllers.getMetrics
);

/* GET /api/seller/dashboard/orders */
router.get(
    "/orders",
    createAuthMiddleware(["seller"]),
    sellerControllers.getOrders
);

/* GET /api/seller/dashboard/products */
router.get(
    "/products",
    createAuthMiddleware(["seller"]),
    sellerControllers.getProducts
);

module.exports = router;
