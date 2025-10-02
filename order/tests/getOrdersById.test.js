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

describe("GET /api/orders/:id", () => {
    const userId = new mongoose.Types.ObjectId();
    const orderId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("returns 200 and order object for existing order when authorized", async () => {
        const token = generateAuthToken(userId.toString(), "user");

        // Mock the order
        const mockOrder = {
            _id: orderId,
            user: userId,
            status: "PENDING",
            items: [
                {
                    product: new mongoose.Types.ObjectId(),
                    quantity: 2,
                    price: { amount: 200, currency: "INR" },
                },
            ],
            totalPrice: { amount: 200, currency: "INR" },
            shippingAddress: {
                street: "123 Main St",
                city: "TestCity",
                pincode: "560001",
                state: "TestState",
                country: "TestCountry",
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        orderModel.findById.mockResolvedValue(mockOrder);

        const res = await request(app)
            .get(`/api/orders/${orderId.toString()}`)
            .set("Cookie", `token=${token}`);

        // Expected behavior - assert the desired contract
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("order");
        expect(res.body.order).toHaveProperty("_id");
        expect(res.body.order._id.toString()).toBe(orderId.toString());
    });

    test("returns 404 when order does not exist", async () => {
        const token = generateAuthToken(userId.toString(), "user");

        // Mock findById to return null
        orderModel.findById.mockResolvedValue(null);

        const res = await request(app)
            .get(`/api/orders/${orderId.toString()}`)
            .set("Cookie", `token=${token}`);

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty("message", "Order not found");
    });

    test("returns 403 when user is not the owner", async () => {
        const token = generateAuthToken(userId.toString(), "user");
        const differentUserId = new mongoose.Types.ObjectId();

        const mockOrder = {
            _id: orderId,
            user: differentUserId, // Different user
            status: "PENDING",
            items: [],
            totalPrice: { amount: 100, currency: "INR" },
            shippingAddress: {
                street: "123 Main St",
                city: "TestCity",
                pincode: "560001",
                state: "TestState",
                country: "TestCountry",
            },
        };

        orderModel.findById.mockResolvedValue(mockOrder);

        const res = await request(app)
            .get(`/api/orders/${orderId.toString()}`)
            .set("Cookie", `token=${token}`);

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty(
            "message",
            "Forbidden: You do not have access to this order"
        );
    });

    test("returns 401 when not authenticated", async () => {
        const res = await request(app).get(`/api/orders/${orderId.toString()}`);

        expect(res.status).toBe(401);
    });
});
