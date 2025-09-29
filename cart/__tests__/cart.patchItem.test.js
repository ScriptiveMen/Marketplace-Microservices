const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cartModel = require("../src/model/cart.model");
const app = require("../src/app");

// Mock the cart model
jest.mock("../src/model/cart.model");

describe("PATCH /api/cart/items/:productId", () => {
    let validToken;
    const userId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId().toString();

    beforeAll(() => {
        process.env.JWT_SECRET_KEY = "test-secret-key";
        validToken = jwt.sign(
            { _id: userId, role: "user" },
            process.env.JWT_SECRET_KEY
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Authentication Tests", () => {
        test("should return 401 when no token is provided", async () => {
            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .send({ qty: 5 });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe(
                "Unauthorized, No token provided"
            );
        });

        test("should return 401 when invalid token is provided", async () => {
            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", "Bearer invalid-token")
                .send({ qty: 5 });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe("Unauthorized: Invalid token");
        });

        test("should return 403 when user has insufficient permissions", async () => {
            const adminToken = jwt.sign(
                { _id: userId, role: "admin" },
                process.env.JWT_SECRET_KEY
            );

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ qty: 5 });

            expect(response.status).toBe(403);
            expect(response.body.message).toBe(
                "Forbidden: Insufficient permission"
            );
        });

        test("should accept token from cookie", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: { toString: () => productId },
                        quantity: 3,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Cookie", `token=${validToken}`)
                .send({ qty: 5 });

            expect(response.status).toBe(200);
        });
    });

    describe("Validation Tests", () => {
        test("should return 400 when productId is invalid ObjectId format", async () => {
            const response = await request(app)
                .patch("/api/cart/items/invalid-id")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 5 });

            expect(response.status).toBe(400);
            expect(response.body.errors).toBeDefined();
        });

        test("should return 400 when qty is missing", async () => {
            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.errors).toBeDefined();
        });

        test("should return 400 when qty is not an integer", async () => {
            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: "abc" });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toBe(
                "Quantity must be a positive integer"
            );
        });

        test("should return 400 when qty is zero", async () => {
            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 0 });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toBe(
                "Quantity must be a positive integer"
            );
        });

        test("should return 400 when qty is negative", async () => {
            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: -5 });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toBe(
                "Quantity must be a positive integer"
            );
        });

        test("should return 400 when qty is a decimal", async () => {
            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 1.5 });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toBe(
                "Quantity must be a positive integer"
            );
        });
    });

    describe("Business Logic Tests", () => {
        test("should return 404 when cart does not exist", async () => {
            cartModel.findOne.mockResolvedValue(null);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 5 });

            expect(response.status).toBe(404);
            expect(response.body.message).toBe("Cart not found");
        });

        test("should return 404 when product is not in cart", async () => {
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: {
                            toString: () =>
                                new mongoose.Types.ObjectId().toString(),
                        },
                        quantity: 2,
                    },
                ],
                save: jest.fn().mockResolvedValue(true),
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 5 });

            expect(response.status).toBe(404);
            expect(response.body.message).toBe("Product not found in cart");
        });

        test("should update quantity of existing item in cart", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: { toString: () => productId },
                        quantity: 3,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 10 });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Cart item updated");
            expect(existingCart.items[0].quantity).toBe(10);
            expect(mockSave).toHaveBeenCalled();
        });

        test("should update quantity when item is at index 0", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: { toString: () => productId },
                        quantity: 1,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 7 });

            expect(response.status).toBe(200);
            expect(existingCart.items[0].quantity).toBe(7);
            expect(mockSave).toHaveBeenCalled();
        });

        test("should update correct item when multiple items in cart", async () => {
            const otherProductId = new mongoose.Types.ObjectId().toString();
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: { toString: () => otherProductId },
                        quantity: 2,
                    },
                    {
                        productId: { toString: () => productId },
                        quantity: 5,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 8 });

            expect(response.status).toBe(200);
            expect(existingCart.items[0].quantity).toBe(2); // Unchanged
            expect(existingCart.items[1].quantity).toBe(8); // Updated
            expect(mockSave).toHaveBeenCalled();
        });

        test("should handle updating to quantity 1 (minimum valid value)", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: { toString: () => productId },
                        quantity: 10,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 1 });

            expect(response.status).toBe(200);
            expect(existingCart.items[0].quantity).toBe(1);
            expect(mockSave).toHaveBeenCalled();
        });

        test("should handle large quantity values", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: { toString: () => productId },
                        quantity: 5,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 999999 });

            expect(response.status).toBe(200);
            expect(existingCart.items[0].quantity).toBe(999999);
            expect(mockSave).toHaveBeenCalled();
        });
    });

    describe("Error Handling Tests", () => {
        test("should handle database errors gracefully", async () => {
            cartModel.findOne.mockRejectedValue(new Error("Database error"));

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 5 });

            expect(response.status).toBe(500);
        });

        test("should handle save errors", async () => {
            const mockSave = jest
                .fn()
                .mockRejectedValue(new Error("Save failed"));
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: { toString: () => productId },
                        quantity: 3,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 5 });

            expect(response.status).toBe(500);
        });
    });

    describe("Edge Cases", () => {
        test("should return updated cart in response", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: { toString: () => productId },
                        quantity: 3,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 6 });

            expect(response.status).toBe(200);
            expect(response.body.cart).toBeDefined();
            expect(response.body.cart.items[0].quantity).toBe(6);
        });

        test("should only update quantity, not add new fields", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: { toString: () => productId },
                        quantity: 3,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 5, extraField: "should be ignored" });

            expect(response.status).toBe(200);
            expect(existingCart.items[0].quantity).toBe(5);
            expect(existingCart.items[0].extraField).toBeUndefined();
        });
    });
});
