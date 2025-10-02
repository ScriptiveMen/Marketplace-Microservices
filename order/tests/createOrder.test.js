const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const Order = require("../src/models/order.model");
const axios = require("axios");

// Mock axios to simulate cart and product service responses
jest.mock("axios");

// Set JWT secret before anything else
process.env.JWT_SECRET_KEY =
    process.env.JWT_SECRET_KEY || "test-secret-key-123";

function generateAuthToken(userId, role = "user") {
    return jwt.sign({ id: userId, role }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
    });
}

describe("POST /api/orders", () => {
    const actualUserId = "68de16ca1898d061ee10e76e";
    const productId1 = new mongoose.Types.ObjectId();
    const productId2 = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("creates order from cart service, verifies stock, and sets status PENDING", async () => {
        const token = generateAuthToken(actualUserId, "user");

        // Mock cart service response
        axios.get.mockImplementation((url) => {
            if (url === "http://localhost:3002/api/cart") {
                return Promise.resolve({
                    data: {
                        cart: {
                            items: [
                                {
                                    productId: productId1.toString(),
                                    quantity: 2,
                                },
                                {
                                    productId: productId2.toString(),
                                    quantity: 1,
                                },
                            ],
                        },
                    },
                });
            }
            // Mock product service responses
            if (url.includes(`/api/products/${productId1}`)) {
                return Promise.resolve({
                    data: {
                        product: {
                            _id: productId1.toString(),
                            title: "Product 1",
                            price: { amount: 100, currency: "INR" },
                            stock: 10,
                        },
                    },
                });
            }
            if (url.includes(`/api/products/${productId2}`)) {
                return Promise.resolve({
                    data: {
                        product: {
                            _id: productId2.toString(),
                            title: "Product 2",
                            price: { amount: 200, currency: "INR" },
                            stock: 5,
                        },
                    },
                });
            }
        });

        const res = await request(app)
            .post("/api/orders")
            .set("Cookie", `token=${token}`)
            .send({
                shippingAddress: {
                    street: "1 Main",
                    city: "Metropolis",
                    pincode: "560001",
                    state: "Unknown",
                    country: "Not defined",
                },
            });

        if (res.status !== 201) {
            console.error("response body:", JSON.stringify(res.body, null, 2));
        }

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("message", "Order placed");
        expect(res.body).toHaveProperty("order");
        expect(res.body.order.status).toBe("PENDING");
        expect(res.body.order.items).toHaveLength(2);

        // Verify order persisted
        const saved = await Order.findById(res.body.order._id).lean();
        expect(saved).not.toBeNull();
        expect(saved.items.length).toBe(2);
        expect(saved.status).toBe("PENDING");

        // Expected: subtotal = (100*2 + 200*1) = 400
        expect(saved.totalPrice.amount).toBe(400);
        expect(saved.totalPrice.currency).toBe("INR");

        // Verify axios was called correctly
        expect(axios.get).toHaveBeenCalledWith(
            "http://localhost:3002/api/cart",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: `Bearer ${token}`,
                }),
            })
        );
    });

    test("returns 500 when product is out of stock", async () => {
        const token = generateAuthToken(actualUserId, "user");

        // Mock cart service response
        axios.get.mockImplementation((url) => {
            if (url === "http://localhost:3002/api/cart") {
                return Promise.resolve({
                    data: {
                        cart: {
                            items: [
                                {
                                    productId: productId1.toString(),
                                    quantity: 20, // More than stock
                                },
                            ],
                        },
                    },
                });
            }
            if (url.includes(`/api/products/${productId1}`)) {
                return Promise.resolve({
                    data: {
                        product: {
                            _id: productId1.toString(),
                            title: "Product 1",
                            price: { amount: 100, currency: "INR" },
                            stock: 10, // Only 10 in stock
                        },
                    },
                });
            }
        });

        const res = await request(app)
            .post("/api/orders")
            .set("Cookie", `token=${token}`)
            .send({
                shippingAddress: {
                    street: "1 Main",
                    city: "Metropolis",
                    pincode: "560001",
                    state: "Unknown",
                    country: "Not defined",
                },
            });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("message", "Internal Server Error");
        expect(res.body.error).toContain("out of stock");
    });

    test("returns 400 when required shipping address fields are missing", async () => {
        const token = generateAuthToken(actualUserId, "user");

        const res = await request(app)
            .post("/api/orders")
            .set("Cookie", `token=${token}`)
            .send({
                shippingAddress: {
                    street: "1 Main",
                    // Missing city, state, country, pincode
                },
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("message");
    });

    test("returns 400 when pincode is invalid", async () => {
        const token = generateAuthToken(actualUserId, "user");

        const res = await request(app)
            .post("/api/orders")
            .set("Cookie", `token=${token}`)
            .send({
                shippingAddress: {
                    street: "1 Main",
                    city: "Metropolis",
                    pincode: "12345", // Only 5 digits, invalid
                    state: "Unknown",
                    country: "Not defined",
                },
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("Pincode must be exactly 6 digits");
    });

    test("returns 401 when no token is provided", async () => {
        const res = await request(app)
            .post("/api/orders")
            .send({
                shippingAddress: {
                    street: "1 Main",
                    city: "Metropolis",
                    pincode: "560001",
                    state: "Unknown",
                    country: "Not defined",
                },
            });

        expect(res.status).toBe(401);
        expect(res.body.message).toContain("Unauthorized");
    });

    test("returns 500 when cart service is unavailable", async () => {
        const token = generateAuthToken(actualUserId, "user");

        // Mock cart service to fail
        axios.get.mockRejectedValue(new Error("Cart service unavailable"));

        const res = await request(app)
            .post("/api/orders")
            .set("Cookie", `token=${token}`)
            .send({
                shippingAddress: {
                    street: "1 Main",
                    city: "Metropolis",
                    pincode: "560001",
                    state: "Unknown",
                    country: "Not defined",
                },
            });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("message", "Internal Server Error");
    });
});
