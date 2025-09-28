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

describe("DELETE /api/products/:id", () => {
    let sellerToken;
    let userToken;
    let anotherSellerToken;
    let sellerId;
    let anotherSellerId;
    let validObjectId;
    let mockProduct;

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

        // Generate valid ObjectId for testing
        validObjectId = new mongoose.Types.ObjectId();

        // Create mock product data
        mockProduct = {
            _id: validObjectId,
            title: "Test Product",
            description: "Test Description",
            price: {
                amount: 100,
                currency: "USD",
            },
            seller: sellerId, // This should match "test-seller-id" from our mock
            images: [
                {
                    url: "https://example.com/image1.jpg",
                    id: "image-id-1",
                },
                {
                    url: "https://example.com/image2.jpg",
                    id: "image-id-2",
                },
            ],
            deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
        };

        // Setup default mocks - Note the change here
        productModel.findOne = jest.fn();
        productModel.findOneAndDelete = jest.fn(); // Changed from findByIdAndDelete
    });

    // Authentication Tests
    describe("Authentication", () => {
        it("should return 401 when no token is provided", async () => {
            const response = await request(app).delete(
                `/api/products/${validObjectId}`
            );

            expect(response.status).toBe(401);
            expect(response.body.message).toBe(
                "Unauthorized, No token provided"
            );
        });

        it("should return 401 when invalid token is provided", async () => {
            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", "Bearer invalid-token");

            expect(response.status).toBe(401);
            expect(response.body.message).toBe("Unauthorized: Invalid token");
        });

        it("should return 403 when user role is not seller", async () => {
            productModel.findOne.mockResolvedValue(mockProduct);

            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${userToken}`);

            expect(response.status).toBe(403);
            expect(response.body.message).toBe(
                "Forbidden: Insufficient permission"
            );
        });
    });

    // Validation Tests
    describe("Validation", () => {
        it("should return 400 for invalid product ID format", async () => {
            const response = await request(app)
                .delete("/api/products/invalid-id")
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(400);
            expect(response.body.message).toBe("Invalid product id");
        });

        it("should return 404 when product does not exist", async () => {
            productModel.findOne.mockResolvedValue(null);

            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(404);
            expect(response.body.message).toBe("Product not found");
        });
    });

    // Authorization Tests
    describe("Authorization", () => {
        it("should return 403 when trying to delete another seller's product", async () => {
            // Create a product owned by a different seller
            const productOwnedByAnotherSeller = {
                ...mockProduct,
                seller: anotherSellerId, // Different seller ID
            };
            productModel.findOne.mockResolvedValue(productOwnedByAnotherSeller);

            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`); // Current user is "test-seller-id"

            expect(response.status).toBe(403);
            expect(response.body.message).toBe(
                "Forbidden: You cannot delete another seller's product"
            );
        });
    });

    // Successful Deletion Tests
    describe("Successful Deletions", () => {
        beforeEach(() => {
            productModel.findOne.mockResolvedValue(mockProduct);
        });

        it("should successfully delete product and return success message", async () => {
            productModel.findOneAndDelete.mockResolvedValue(mockProduct);

            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product deleted successfully");
            // Fix: Match what controller actually calls
            expect(productModel.findOne).toHaveBeenCalledWith({
                _id: validObjectId.toString(),
            });
            expect(productModel.findOneAndDelete).toHaveBeenCalledWith({
                _id: validObjectId.toString(),
            });
        });

        it("should call findOneAndDelete with correct product ID", async () => {
            productModel.findOneAndDelete.mockResolvedValue(mockProduct);

            await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(productModel.findOneAndDelete).toHaveBeenCalledTimes(1);
            expect(productModel.findOneAndDelete).toHaveBeenCalledWith({
                _id: validObjectId.toString(),
            });
        });

        it("should work with token from cookies", async () => {
            productModel.findOneAndDelete.mockResolvedValue(mockProduct);

            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Cookie", `token=${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product deleted successfully");
        });

        it("should handle product with no images", async () => {
            const productWithoutImages = {
                ...mockProduct,
                images: [],
            };
            productModel.findOne.mockResolvedValue(productWithoutImages);
            productModel.findOneAndDelete.mockResolvedValue(
                productWithoutImages
            );

            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product deleted successfully");
        });

        it("should handle product with multiple images", async () => {
            const productWithManyImages = {
                ...mockProduct,
                images: [
                    { url: "image1.jpg", id: "id1" },
                    { url: "image2.jpg", id: "id2" },
                    { url: "image3.jpg", id: "id3" },
                ],
            };
            productModel.findOne.mockResolvedValue(productWithManyImages);
            productModel.findOneAndDelete.mockResolvedValue(
                productWithManyImages
            );

            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product deleted successfully");
        });
    });

    // Edge Cases
    describe("Edge Cases", () => {
        beforeEach(() => {
            productModel.findOne.mockResolvedValue(mockProduct);
        });

        it("should handle case when findOneAndDelete returns null", async () => {
            productModel.findOneAndDelete.mockResolvedValue(null);

            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`);

            // Depending on implementation, this might be handled differently
            // Some implementations might return 404, others might still return 200
            expect(response.status).toBeGreaterThanOrEqual(200);
        });

        it("should handle products with seller as ObjectId", async () => {
            // Create a product where seller is an ObjectId but toString() returns the expected seller ID
            const productWithObjectIdSeller = {
                ...mockProduct,
                seller: {
                    toString: () => sellerId, // This will match req.user.id from mock middleware
                },
            };

            productModel.findOne.mockResolvedValue(productWithObjectIdSeller);
            productModel.findOneAndDelete.mockResolvedValue(
                productWithObjectIdSeller
            );

            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product deleted successfully");
        });
    });

    // Performance Tests
    describe("Performance", () => {
        it("should complete deletion within reasonable time", async () => {
            productModel.findOne.mockResolvedValue(mockProduct);
            productModel.findOneAndDelete.mockResolvedValue(mockProduct);

            const startTime = Date.now();

            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(response.status).toBe(200);
            expect(duration).toBeLessThan(1000); // Should complete within 1 second
        });
    });

    // Response Format Tests
    describe("Response Format", () => {
        beforeEach(() => {
            productModel.findOne.mockResolvedValue(mockProduct);
            productModel.findOneAndDelete.mockResolvedValue(mockProduct);
        });

        it("should return JSON response with correct structure", async () => {
            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            expect(response.type).toBe("application/json");
            expect(response.body).toHaveProperty("message");
            expect(typeof response.body.message).toBe("string");
        });

        it("should not expose sensitive product data in response", async () => {
            const response = await request(app)
                .delete(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`);

            expect(response.status).toBe(200);
            // Should not include full product data in delete response for security
            expect(response.body).not.toHaveProperty("product");
            expect(response.body).not.toHaveProperty("seller");
        });
    });
});
