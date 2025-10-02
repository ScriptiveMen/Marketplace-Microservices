const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cartModel = require("../src/model/cart.model");
const app = require("../src/app");

// Mock the cart model
jest.mock("../src/model/cart.model");

describe("GET /api/cart", () => {
    let validToken;
    const userId = new mongoose.Types.ObjectId();

    beforeAll(() => {
        process.env.JWT_SECRET_KEY = "test-secret-key";
        // CHANGED: Use 'id' instead of '_id' to match your auth middleware
        validToken = jwt.sign(
            { id: userId.toString(), role: "user" },
            process.env.JWT_SECRET_KEY
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Authentication Tests", () => {
        test("should return 401 when no token is provided", async () => {
            const response = await request(app).get("/api/cart");
            expect(response.status).toBe(401);
            expect(response.body.message).toBe(
                "Unauthorized, No token provided"
            );
        });

        test("should return 401 when invalid token is provided", async () => {
            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", "Bearer invalid-token");
            expect(response.status).toBe(401);
            expect(response.body.message).toBe("Unauthorized: Invalid token");
        });

        test("should return 403 when user has insufficient permissions", async () => {
            // CHANGED: Use 'id' instead of '_id'
            const adminToken = jwt.sign(
                { id: userId.toString(), role: "admin" },
                process.env.JWT_SECRET_KEY
            );
            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(response.status).toBe(403);
            expect(response.body.message).toBe(
                "Forbidden: Insufficient permission"
            );
        });

        test("should accept token from cookie", async () => {
            const mockCart = {
                user: userId,
                items: [],
            };
            cartModel.findOne.mockResolvedValue(mockCart);
            const response = await request(app)
                .get("/api/cart")
                .set("Cookie", `token=${validToken}`);
            expect(response.status).toBe(200);
        });

        test("should accept token from Authorization header", async () => {
            const mockCart = {
                user: userId,
                items: [],
            };
            cartModel.findOne.mockResolvedValue(mockCart);
            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);
            expect(response.status).toBe(200);
        });
    });

    describe("Business Logic Tests", () => {
        test("should create and return new cart when cart does not exist", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const newCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [],
                save: mockSave,
            };
            cartModel.findOne.mockResolvedValue(null);
            cartModel.mockImplementation(() => newCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.cart).toBeDefined();
            expect(response.body.cart.items).toEqual([]);
            expect(mockSave).toHaveBeenCalled();
        });

        test("should return existing cart when cart exists", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 2,
                    },
                ],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.cart).toBeDefined();
            expect(response.body.cart.items).toHaveLength(1);
        });

        test("should return empty cart with zero totals when no items", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.cart.items).toEqual([]);
            expect(response.body.totals.itemCount).toBe(0);
            expect(response.body.totals.totalQuantity).toBe(0);
        });

        test("should return correct item count and total quantity for single item", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 5,
                    },
                ],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.totals.itemCount).toBe(1);
            expect(response.body.totals.totalQuantity).toBe(5);
        });

        test("should return correct totals for multiple items", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 2,
                    },
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 3,
                    },
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 1,
                    },
                ],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.totals.itemCount).toBe(3);
            expect(response.body.totals.totalQuantity).toBe(6); // 2 + 3 + 1
        });

        test("should handle large quantities correctly", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 100,
                    },
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 500,
                    },
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 250,
                    },
                ],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.totals.itemCount).toBe(3);
            expect(response.body.totals.totalQuantity).toBe(850); // 100 + 500 + 250
        });

        test("should query cart using user.id from token", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            // CHANGED: Expect user.id (string) instead of user._id
            expect(cartModel.findOne).toHaveBeenCalledWith({
                user: userId.toString(),
            });
        });
    });

    describe("Response Structure Tests", () => {
        test("should return response with cart and totals structure", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 3,
                    },
                ],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("cart");
            expect(response.body).toHaveProperty("totals");
            expect(response.body.totals).toHaveProperty("itemCount");
            expect(response.body.totals).toHaveProperty("totalQuantity");
        });

        test("should return cart with _id and user properties", async () => {
            const cartId = new mongoose.Types.ObjectId();
            const mockCart = {
                _id: cartId,
                user: userId,
                items: [],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.cart._id).toBeDefined();
            expect(response.body.cart.user).toBeDefined();
        });

        test("should return items array in cart", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 2,
                    },
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 4,
                    },
                ],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.cart.items)).toBe(true);
            expect(response.body.cart.items).toHaveLength(2);
        });
    });

    describe("Cart Creation Tests", () => {
        test("should create new cart with empty items when cart doesn't exist", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const newCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [],
                save: mockSave,
            };
            cartModel.findOne.mockResolvedValue(null);
            cartModel.mockImplementation(() => newCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            // CHANGED: Expect user.id (string) instead of user._id
            expect(cartModel).toHaveBeenCalledWith({
                user: userId.toString(),
                items: [],
            });
            expect(mockSave).toHaveBeenCalled();
            expect(response.body.cart.items).toEqual([]);
        });

        test("should not create new cart when cart already exists", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 1,
                    },
                ],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            // cartModel constructor should not be called
            expect(cartModel).not.toHaveBeenCalled();
        });
    });

    describe("Edge Cases", () => {
        test("should handle cart with single item quantity 1", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 1,
                    },
                ],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.totals.itemCount).toBe(1);
            expect(response.body.totals.totalQuantity).toBe(1);
        });

        test("should handle very large item count", async () => {
            const items = Array.from({ length: 50 }, () => ({
                productId: new mongoose.Types.ObjectId(),
                quantity: 1,
            }));
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: items,
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.totals.itemCount).toBe(50);
            expect(response.body.totals.totalQuantity).toBe(50);
        });

        test("should handle mixed quantities correctly", async () => {
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 1,
                    },
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 10,
                    },
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 100,
                    },
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 5,
                    },
                ],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.totals.itemCount).toBe(4);
            expect(response.body.totals.totalQuantity).toBe(116); // 1 + 10 + 100 + 5
        });
    });

    describe("Integration with User Authentication", () => {
        test("should return cart specific to authenticated user", async () => {
            const user1Id = new mongoose.Types.ObjectId();
            // CHANGED: Use 'id' instead of '_id'
            const token1 = jwt.sign(
                { id: user1Id.toString(), role: "user" },
                process.env.JWT_SECRET_KEY
            );
            const mockCart = {
                _id: new mongoose.Types.ObjectId(),
                user: user1Id,
                items: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        quantity: 3,
                    },
                ],
            };
            cartModel.findOne.mockResolvedValue(mockCart);

            await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${token1}`);

            // CHANGED: Expect user.id (string)
            expect(cartModel.findOne).toHaveBeenCalledWith({
                user: user1Id.toString(),
            });
        });

        test("should create cart for new user on first access", async () => {
            const newUserId = new mongoose.Types.ObjectId();
            // CHANGED: Use 'id' instead of '_id'
            const newUserToken = jwt.sign(
                { id: newUserId.toString(), role: "user" },
                process.env.JWT_SECRET_KEY
            );
            const mockSave = jest.fn().mockResolvedValue(true);
            const newCart = {
                _id: new mongoose.Types.ObjectId(),
                user: newUserId,
                items: [],
                save: mockSave,
            };
            cartModel.findOne.mockResolvedValue(null);
            cartModel.mockImplementation(() => newCart);

            const response = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${newUserToken}`);

            expect(response.status).toBe(200);
            // CHANGED: Expect user.id (string)
            expect(cartModel).toHaveBeenCalledWith({
                user: newUserId.toString(),
                items: [],
            });
            expect(mockSave).toHaveBeenCalled();
        });
    });
});
