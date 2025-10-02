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

describe("PATCH /api/orders/:id/address", () => {
    const userId = new mongoose.Types.ObjectId();
    const orderId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("updates delivery address prior to payment capture", async () => {
        const token = generateAuthToken(userId.toString(), "user");

        // Mock the order object
        const mockOrder = {
            _id: orderId,
            user: userId,
            status: "PENDING",
            shippingAddress: {
                street: "Old St",
                city: "OldCity",
                pincode: "560001",
                state: "OldState",
                country: "OldCountry",
            },
            save: jest.fn().mockResolvedValue(true),
        };

        // Mock findById to return the mock order
        orderModel.findById.mockResolvedValue(mockOrder);

        const res = await request(app)
            .patch(`/api/orders/${orderId.toString()}/address`)
            .set("Cookie", `token=${token}`)
            .send({
                shippingAddress: {
                    street: "New St",
                    city: "NewCity",
                    pincode: "560002",
                    state: "S",
                    country: "C",
                },
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("order");
        expect(mockOrder.save).toHaveBeenCalled();
        expect(mockOrder.shippingAddress.street).toBe("New St");
        expect(mockOrder.shippingAddress.city).toBe("NewCity");
        expect(mockOrder.shippingAddress.pincode).toBe("560002");
    });

    test("returns 400 when pincode invalid", async () => {
        const token = generateAuthToken(userId.toString(), "user");

        const res = await request(app)
            .patch(`/api/orders/${orderId.toString()}/address`)
            .set("Cookie", `token=${token}`)
            .send({
                shippingAddress: {
                    street: "New St",
                    city: "NewCity",
                    pincode: "12345", // Invalid: only 5 digits
                    state: "S",
                    country: "C",
                },
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("message");
    });

    test("returns 404 when order not found", async () => {
        const token = generateAuthToken(userId.toString(), "user");

        // Mock findById to return null (order not found)
        orderModel.findById.mockResolvedValue(null);

        const res = await request(app)
            .patch(`/api/orders/${orderId.toString()}/address`)
            .set("Cookie", `token=${token}`)
            .send({
                shippingAddress: {
                    street: "New St",
                    city: "NewCity",
                    pincode: "560002",
                    state: "S",
                    country: "C",
                },
            });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty("message", "Order not found");
    });

    test("returns 409 when user is not the owner", async () => {
        const token = generateAuthToken(userId.toString(), "user");
        const differentUserId = new mongoose.Types.ObjectId();

        const mockOrder = {
            _id: orderId,
            user: differentUserId, // Different user
            status: "PENDING",
            shippingAddress: {
                street: "Old St",
                city: "OldCity",
                pincode: "560001",
                state: "OldState",
                country: "OldCountry",
            },
        };

        orderModel.findById.mockResolvedValue(mockOrder);

        const res = await request(app)
            .patch(`/api/orders/${orderId.toString()}/address`)
            .set("Cookie", `token=${token}`)
            .send({
                shippingAddress: {
                    street: "New St",
                    city: "NewCity",
                    pincode: "560002",
                    state: "S",
                    country: "C",
                },
            });

        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty("message");
    });

    test("returns 409 when order is not PENDING", async () => {
        const token = generateAuthToken(userId.toString(), "user");

        const mockOrder = {
            _id: orderId,
            user: userId,
            status: "SHIPPED", // Not PENDING
            shippingAddress: {
                street: "Old St",
                city: "OldCity",
                pincode: "560001",
                state: "OldState",
                country: "OldCountry",
            },
        };

        orderModel.findById.mockResolvedValue(mockOrder);

        const res = await request(app)
            .patch(`/api/orders/${orderId.toString()}/address`)
            .set("Cookie", `token=${token}`)
            .send({
                shippingAddress: {
                    street: "New St",
                    city: "NewCity",
                    pincode: "560002",
                    state: "S",
                    country: "C",
                },
            });

        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty(
            "message",
            "Order address cannot be updated at this stage"
        );
    });
});
