const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cartModel = require("../src/model/cart.model");
const app = require("../src/app");

// Mock the cart model
jest.mock("../src/model/cart.model");

describe("POST /api/cart/items", () => {
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
                .post("/api/cart/items")
                .send({ productId, qty: 1 });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe(
                "Unauthorized, No token provided"
            );
        });

        test("should return 401 when invalid token is provided", async () => {
            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", "Bearer invalid-token")
                .send({ productId, qty: 1 });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe("Unauthorized: Invalid token");
        });

        test("should return 403 when user has insufficient permissions", async () => {
            const adminToken = jwt.sign(
                { _id: userId, role: "admin" },
                process.env.JWT_SECRET_KEY
            );

            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ productId, qty: 1 });

            expect(response.status).toBe(403);
            expect(response.body.message).toBe(
                "Forbidden: Insufficient permission"
            );
        });

        test("should accept token from cookie", async () => {
            cartModel.findOne.mockResolvedValue(null);
            cartModel.mockImplementation(() => ({
                items: [],
                save: jest.fn().mockResolvedValue(true),
            }));

            const response = await request(app)
                .post("/api/cart/items")
                .set("Cookie", `token=${validToken}`)
                .send({ productId, qty: 1 });

            expect(response.status).toBe(200);
        });
    });

    describe("Validation Tests", () => {
        test("should return 400 when productId is missing", async () => {
            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ qty: 1 });

            expect(response.status).toBe(400);
            expect(response.body.errors).toBeDefined();
        });

        test("should return 400 when productId is not a string", async () => {
            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId: 12345, qty: 1 });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toBe(
                "Product id must be a string"
            );
        });

        test("should return 400 when productId is invalid ObjectId format", async () => {
            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId: "invalid-id", qty: 1 });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toBe(
                "invalid Product Id format"
            );
        });

        test("should return 400 when qty is missing", async () => {
            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId });

            expect(response.status).toBe(400);
            expect(response.body.errors).toBeDefined();
        });

        test("should return 400 when qty is not an integer", async () => {
            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: "abc" });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toBe(
                "Quantity must be a positive integer"
            );
        });

        test("should return 400 when qty is zero", async () => {
            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 0 });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toBe(
                "Quantity must be a positive integer"
            );
        });

        test("should return 400 when qty is negative", async () => {
            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: -5 });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toBe(
                "Quantity must be a positive integer"
            );
        });

        test("should return 400 when qty is a decimal", async () => {
            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 1.5 });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toBe(
                "Quantity must be a positive integer"
            );
        });
    });

    describe("Business Logic Tests", () => {
        test("should create new cart and add item when cart does not exist", async () => {
            cartModel.findOne.mockResolvedValue(null);
            const mockSave = jest.fn().mockResolvedValue(true);
            cartModel.mockImplementation(() => ({
                user: userId,
                items: [{ productId, quantity: 2 }],
                save: mockSave,
            }));

            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 2 });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Item added to cart");
            expect(response.body.cart).toBeDefined();
            expect(mockSave).toHaveBeenCalled();
        });

        test("should add new item to existing cart", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId().toString(),
                        quantity: 1,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 3 });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Item added to cart");
            expect(existingCart.items.length).toBe(2);
            expect(mockSave).toHaveBeenCalled();
        });

        test("should update quantity when item already exists in cart", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: { toString: () => productId },
                        quantity: 2,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 3 });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Item added to cart");
            expect(existingCart.items[0].quantity).toBe(5);
            expect(mockSave).toHaveBeenCalled();
        });

        test("should update quantity when item exists at index 0", async () => {
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
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 2 });

            expect(response.status).toBe(200);
            expect(existingCart.items.length).toBe(1);
            expect(existingCart.items[0].quantity).toBe(3);
            expect(mockSave).toHaveBeenCalled();
        });

        test("should handle large quantity values", async () => {
            cartModel.findOne.mockResolvedValue(null);
            const mockSave = jest.fn().mockResolvedValue(true);
            cartModel.mockImplementation(() => ({
                user: userId,
                items: [],
                save: mockSave,
            }));

            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 999999 });

            expect(response.status).toBe(200);
            expect(mockSave).toHaveBeenCalled();
        });
    });

    describe("Error Handling Tests", () => {
        test("should handle database errors gracefully", async () => {
            cartModel.findOne.mockRejectedValue(new Error("Database error"));

            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 1 });

            expect(response.status).toBe(500);
        });

        test("should handle save errors", async () => {
            const mockSave = jest
                .fn()
                .mockRejectedValue(new Error("Save failed"));
            cartModel.findOne.mockResolvedValue({
                user: userId,
                items: [],
                save: mockSave,
            });

            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 1 });

            expect(response.status).toBe(500);
        });
    });

    describe("Edge Cases", () => {
        test("should handle multiple items in cart", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const existingCart = {
                user: userId,
                items: [
                    {
                        productId: {
                            toString: () =>
                                new mongoose.Types.ObjectId().toString(),
                        },
                        quantity: 1,
                    },
                    {
                        productId: {
                            toString: () =>
                                new mongoose.Types.ObjectId().toString(),
                        },
                        quantity: 2,
                    },
                ],
                save: mockSave,
            };

            cartModel.findOne.mockResolvedValue(existingCart);

            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 1 });

            expect(response.status).toBe(200);
            expect(existingCart.items.length).toBe(3);
        });

        test("should handle quantity 1 (minimum valid value)", async () => {
            cartModel.findOne.mockResolvedValue(null);
            const mockSave = jest.fn().mockResolvedValue(true);
            cartModel.mockImplementation(() => ({
                user: userId,
                items: [],
                save: mockSave,
            }));

            const response = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ productId, qty: 1 });

            expect(response.status).toBe(200);
        });
    });
});
