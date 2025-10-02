const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const orderModel = require("../src/models/order.model");

// Mock the order model
jest.mock("../src/models/order.model");

process.env.JWT_SECRET_KEY =
    process.env.JWT_SECRET_KEY || "test-secret-key-123";

function generateAuthToken(userId, role = "user") {
    return jwt.sign({ id: userId, role }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
    });
}

describe("POST /api/orders/:id/cancel", () => {
    const userId = new mongoose.Types.ObjectId();
    const orderId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("allows buyer to cancel an order that is pending", async () => {
        const token = generateAuthToken(userId.toString(), "user");

        // Mock the order object
        const mockOrder = {
            _id: orderId,
            user: userId,
            status: "PENDING",
            items: [
                {
                    product: new mongoose.Types.ObjectId(),
                    quantity: 2,
                    price: { amount: 2000, currency: "INR" },
                },
            ],
            totalPrice: { amount: 2000, currency: "INR" },
            shippingAddress: {
                street: "123 Main St",
                city: "Mumbai",
                pincode: "400001",
                state: "Maharashtra",
                country: "India",
            },
            save: jest.fn().mockResolvedValue(true),
        };

        // Mock findById to return the mock order
        orderModel.findById.mockResolvedValue(mockOrder);

        const res = await request(app)
            .post(`/api/orders/${orderId.toString()}/cancel`)
            .set("Cookie", `token=${token}`)
            .send({ reason: "Changed my mind" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("order");
        expect(mockOrder.save).toHaveBeenCalled();
        expect(mockOrder.status).toBe("CANCELLED");
    });

    test("returns 404 when order not found", async () => {
        const token = generateAuthToken(userId.toString(), "user");

        // Mock findById to return null (order not found)
        orderModel.findById.mockResolvedValue(null);

        const res = await request(app)
            .post(`/api/orders/${orderId.toString()}/cancel`)
            .set("Cookie", `token=${token}`)
            .send({ reason: "Test cancel" });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty("message", "Order not found");
    });

    test("returns 403 when user is not the owner", async () => {
        const token = generateAuthToken(userId.toString(), "user");
        const differentUserId = new mongoose.Types.ObjectId();

        const mockOrder = {
            _id: orderId,
            user: differentUserId, // Different user owns this order
            status: "PENDING",
            items: [],
            totalPrice: { amount: 2000, currency: "INR" },
        };

        orderModel.findById.mockResolvedValue(mockOrder);

        const res = await request(app)
            .post(`/api/orders/${orderId.toString()}/cancel`)
            .set("Cookie", `token=${token}`)
            .send({ reason: "Attempted cancel by non-owner" });

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty(
            "message",
            "Forbidden: You do not have access to this order "
        );
    });

    test("returns 409 when order is not PENDING", async () => {
        const token = generateAuthToken(userId.toString(), "user");

        const mockOrder = {
            _id: orderId,
            user: userId,
            status: "SHIPPED", // Already shipped, cannot cancel
            items: [],
            totalPrice: { amount: 2000, currency: "INR" },
        };

        orderModel.findById.mockResolvedValue(mockOrder);

        const res = await request(app)
            .post(`/api/orders/${orderId.toString()}/cancel`)
            .set("Cookie", `token=${token}`)
            .send({ reason: "Want to cancel" });

        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty(
            "message",
            "Your order cannot be cancelled at this stage"
        );
    });

    test("returns 401 when no authentication token provided", async () => {
        const res = await request(app)
            .post(`/api/orders/${orderId.toString()}/cancel`)
            .send({ reason: "Test cancel" });

        expect(res.status).toBe(401);
    });
});
