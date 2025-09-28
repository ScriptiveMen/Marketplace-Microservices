const request = require("supertest");
const mongoose = require("mongoose");

// Mock the product model
jest.mock("../src/models/product.model");

// Mock uuid to avoid ES module issues
jest.mock("uuid", () => ({
    v4: () => "mocked-uuid",
}));

// Mock imagekit service to avoid the uuid dependency
jest.mock("../src/services/imagekit.service", () => ({
    uploadImage: jest.fn().mockResolvedValue({
        url: "https://mocked-imagekit-url.com/image.jpg",
        thumbnail: "https://mocked-imagekit-url.com/thumbnail.jpg",
        id: "mocked-file-id",
    }),
}));

// Mock auth middleware to avoid JWT issues
jest.mock("../src/middlewares/auth.middleware", () => {
    return jest.fn((allowedRoles = ["user"]) => {
        return (req, res, next) => {
            const token =
                req.cookies?.token || req.headers?.authorization?.split(" ")[1];

            if (!token) {
                return res.status(401).json({
                    message: "Unauthorized, No token provided",
                });
            }

            // Mock different users based on token content
            if (token === "invalid-token") {
                return res.status(401).json({
                    message: "Unauthorized: Invalid token",
                });
            }

            if (token.includes("seller")) {
                const sellerId = token.includes("another")
                    ? "another-seller-id"
                    : "test-seller-id";
                if (!allowedRoles.includes("seller")) {
                    return res.status(403).json({
                        message: "Forbidden: Insufficient permission",
                    });
                }
                req.user = { id: sellerId, role: "seller" };
            } else if (token.includes("user")) {
                if (!allowedRoles.includes("user")) {
                    return res.status(403).json({
                        message: "Forbidden: Insufficient permission",
                    });
                }
                req.user = { id: "test-user-id", role: "user" };
            }

            next();
        };
    });
});

const app = require("../src/app");
const productModel = require("../src/models/product.model");

describe("GET /api/products/seller", () => {
    let sellerToken;
    let userToken;
    let anotherSellerToken;
    let sellerId;
    let anotherSellerId;
    let mockProducts;
    let mockQuery;

    beforeAll(() => {
        // Simple token strings that our mock middleware will recognize
        sellerToken = "seller-token";
        userToken = "user-token";
        anotherSellerToken = "another-seller-token";

        // These will match what the mock middleware sets
        sellerId = "test-seller-id";
        anotherSellerId = "another-seller-id";
    });

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Create mock products data
        mockProducts = [
            {
                _id: new mongoose.Types.ObjectId(),
                title: "Seller Product 1",
                description: "First product by seller",
                price: {
                    amount: 100,
                    currency: "INR",
                },
                seller: sellerId,
                images: [
                    {
                        url: "https://example.com/image1.jpg",
                        id: "image-id-1",
                    },
                ],
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
            },
            {
                _id: new mongoose.Types.ObjectId(),
                title: "Seller Product 2",
                description: "Second product by seller",
                price: {
                    amount: 200,
                    currency: "INR",
                },
                seller: sellerId,
                images: [
                    {
                        url: "https://example.com/image2.jpg",
                        id: "image-id-2",
                    },
                ],
                createdAt: new Date("2024-01-02"),
                updatedAt: new Date("2024-01-02"),
            },
        ];

        // Mock the query chain to match actual controller implementation
        mockQuery = {
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(mockProducts),
        };

        // Setup default mocks - Note: no query chaining, direct resolution
        productModel.find = jest.fn().mockReturnValue(mockQuery);
    });

    // Authentication Tests
    describe("Authentication", () => {
        it("should return 401 when no token is provided", async () => {
            const response = await request(app).get("/api/products/seller");

            expect(response.status).toBe(401);
            expect(response.body.message).toBe(
                "Unauthorized, No token provided"
            );
        });

        it("should return 401 when invalid token is provided", async () => {
            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", "Bearer invalid-token");

            expect(response.status).toBe(401);
            expect(response.body.message).toBe("Unauthorized: Invalid token");
        });

        it("should return 403 when user role is not seller", async () => {
            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${userToken}`);

            expect(response.status).toBe(403);
            expect(response.body.message).toBe(
                "Forbidden: Insufficient permission"
            );
        });
    });

    // Successful Retrieval Tests
    describe("Successful Retrievals", () => {
        beforeEach(() => {
            productModel.find.mockReturnValue(mockQuery);
        });

        it("should return seller's products successfully", async () => {
            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("data");
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data[0].title).toBe("Seller Product 1");
            expect(response.body.data[1].title).toBe("Seller Product 2");
        });

        it("should filter products by authenticated seller ID", async () => {
            await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(productModel.find).toHaveBeenCalledWith({
                seller: sellerId,
            });
        });

        it("should return empty array when seller has no products", async () => {
            mockQuery.limit.mockResolvedValue([]);

            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual([]);
        });

        it("should work with token from cookies", async () => {
            const response = await request(app)
                .get("/api/products/seller")
                .set("Cookie", `token=${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(2);
        });
    });

    // Pagination Tests
    describe("Pagination", () => {
        beforeEach(() => {
            productModel.find.mockReturnValue(mockQuery);
        });

        it("should handle pagination with skip and limit", async () => {
            const response = await request(app)
                .get("/api/products/seller?skip=10&limit=5")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(mockQuery.skip).toHaveBeenCalledWith("10"); // Query params are strings
            expect(mockQuery.limit).toHaveBeenCalledWith(5);
        });

        it("should use default pagination when not specified", async () => {
            await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(mockQuery.skip).toHaveBeenCalledWith(0);
            expect(mockQuery.limit).toHaveBeenCalledWith(20);
        });

        it("should limit maximum items per page to 20", async () => {
            await request(app)
                .get("/api/products/seller?limit=50")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(mockQuery.limit).toHaveBeenCalledWith(20);
        });

        it("should handle string values for skip and limit", async () => {
            await request(app)
                .get("/api/products/seller?skip=5&limit=10")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(mockQuery.skip).toHaveBeenCalledWith("5");
            expect(mockQuery.limit).toHaveBeenCalledWith(10);
        });
    });

    // Response Format Tests
    describe("Response Format", () => {
        beforeEach(() => {
            productModel.find.mockReturnValue(mockQuery);
        });

        it("should return JSON response with correct structure", async () => {
            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.type).toBe("application/json");
            expect(response.body).toHaveProperty("data");
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it("should not include pagination metadata", async () => {
            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("data");
            // Should not have total, skip, limit in response based on controller
            expect(response.body).not.toHaveProperty("total");
            expect(response.body).not.toHaveProperty("skip");
            expect(response.body).not.toHaveProperty("limit");
        });

        it("should include all required product fields", async () => {
            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            const product = response.body.data[0];
            expect(product).toHaveProperty("_id");
            expect(product).toHaveProperty("title");
            expect(product).toHaveProperty("description");
            expect(product).toHaveProperty("price");
            expect(product.price).toHaveProperty("amount");
            expect(product.price).toHaveProperty("currency");
            expect(product).toHaveProperty("seller");
            expect(product).toHaveProperty("images");
        });

        it("should return seller field as string", async () => {
            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            const product = response.body.data[0];
            expect(product.seller).toBe(sellerId);
            expect(typeof product.seller).toBe("string");
        });
    });

    // Database Query Tests
    describe("Database Query Tests", () => {
        beforeEach(() => {
            productModel.find.mockReturnValue(mockQuery);
        });

        it("should call database methods in correct order", async () => {
            await request(app)
                .get("/api/products/seller?skip=5&limit=10")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(productModel.find).toHaveBeenCalledWith({
                seller: sellerId,
            });
            expect(mockQuery.skip).toHaveBeenCalledWith("5");
            expect(mockQuery.limit).toHaveBeenCalledWith(10);
        });

        it("should make only one database call", async () => {
            await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(productModel.find).toHaveBeenCalledTimes(1);
        });
    });

    // Error Handling Tests
    describe("Error Handling", () => {
        it("should handle database errors gracefully", async () => {
            productModel.find.mockImplementation(() => {
                throw new Error("Database connection error");
            });

            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            // Since controller has no try-catch, this will be handled by global error handler
            // Adjust expectation based on your app's error handling
            expect(response.status).toBeGreaterThanOrEqual(500);
        });

        it("should handle query chain errors", async () => {
            mockQuery.limit.mockRejectedValue(new Error("Query error"));
            productModel.find.mockReturnValue(mockQuery);

            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            // Since controller has no try-catch, this will be handled by global error handler
            expect(response.status).toBeGreaterThanOrEqual(500);
        });
    });

    // Edge Cases
    describe("Edge Cases", () => {
        beforeEach(() => {
            productModel.find.mockReturnValue(mockQuery);
        });

        it("should handle seller with different ID formats", async () => {
            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${anotherSellerToken}`);

            expect(response.status).toBe(200);
            expect(productModel.find).toHaveBeenCalledWith({
                seller: anotherSellerId,
            });
        });

        it("should handle products with missing optional fields", async () => {
            const productsWithMissingFields = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    title: "Minimal Product",
                    price: { amount: 50, currency: "INR" },
                    seller: sellerId,
                    images: [],
                    // description is missing
                },
            ];

            mockQuery.limit.mockResolvedValue(productsWithMissingFields);

            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].title).toBe("Minimal Product");
        });

        it("should handle zero limit", async () => {
            await request(app)
                .get("/api/products/seller?limit=0")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(mockQuery.limit).toHaveBeenCalledWith(0);
        });

        it("should handle negative skip", async () => {
            await request(app)
                .get("/api/products/seller?skip=-5")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(mockQuery.skip).toHaveBeenCalledWith("-5");
        });
    });

    // Performance Tests
    describe("Performance", () => {
        beforeEach(() => {
            productModel.find.mockReturnValue(mockQuery);
        });

        it("should complete request within reasonable time", async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(response.status).toBe(200);
            expect(duration).toBeLessThan(1000); // Should complete within 1 second
        });

        it("should use efficient database queries", async () => {
            await request(app)
                .get("/api/products/seller")
                .set("Authorization", `Bearer ${sellerToken}`);

            // Should only make one database call
            expect(productModel.find).toHaveBeenCalledTimes(1);
        });
    });
});
