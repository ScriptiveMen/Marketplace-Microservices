const request = require("supertest");
const jwt = require("jsonwebtoken");
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

describe("PATCH /api/products/:id", () => {
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
            images: [],
            save: jest.fn().mockResolvedValue(true),
        };

        // Setup default mocks
        productModel.findOne = jest.fn();
    });

    // Authentication Tests
    describe("Authentication", () => {
        it("should return 401 when no token is provided", async () => {
            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .send({ title: "Updated Title" });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe(
                "Unauthorized, No token provided"
            );
        });

        it("should return 401 when invalid token is provided", async () => {
            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", "Bearer invalid-token")
                .send({ title: "Updated Title" });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe("Unauthorized: Invalid token");
        });

        it("should return 403 when user role is not seller", async () => {
            productModel.findOne.mockResolvedValue(mockProduct);

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ title: "Updated Title" });

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
                .patch("/api/products/invalid-id")
                .set("Authorization", `Bearer ${sellerToken}`)
                .send({ title: "Updated Title" });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe("Invalid product id");
        });

        it("should return 404 when product does not exist", async () => {
            productModel.findOne.mockResolvedValue(null);

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send({ title: "Updated Title" });

            expect(response.status).toBe(404);
            expect(response.body.message).toBe("Product not found");
        });
    });

    // Authorization Tests
    describe("Authorization", () => {
        it("should return 403 when trying to update another seller's product", async () => {
            // Create a product owned by a different seller
            const productOwnedByAnotherSeller = {
                ...mockProduct,
                seller: anotherSellerId, // Different seller ID
            };
            productModel.findOne.mockResolvedValue(productOwnedByAnotherSeller);

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`) // Current user is "test-seller-id"
                .send({ title: "Updated Title" });

            expect(response.status).toBe(403);
            expect(response.body.message).toBe(
                "Forbidden: You cannot update another seller's product"
            );
        });
    });

    // Successful Update Tests
    describe("Successful Updates", () => {
        beforeEach(() => {
            productModel.findOne.mockResolvedValue(mockProduct);
        });

        it("should successfully update product title", async () => {
            const updateData = { title: "Updated Product Title" };
            const updatedProduct = { ...mockProduct, title: updateData.title };
            mockProduct.save.mockResolvedValue(updatedProduct);

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product updated successfully");
            expect(mockProduct.title).toBe(updateData.title);
            expect(mockProduct.save).toHaveBeenCalled();
        });

        it("should successfully update product description", async () => {
            const updateData = { description: "Updated product description" };

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product updated successfully");
            expect(mockProduct.description).toBe(updateData.description);
        });

        it("should successfully update price amount", async () => {
            const updateData = {
                price: {
                    amount: 150,
                },
            };

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product updated successfully");
            expect(mockProduct.price.amount).toBe(150);
            expect(mockProduct.price.currency).toBe("USD"); // Should remain unchanged
        });

        it("should successfully update price currency", async () => {
            const updateData = {
                price: {
                    currency: "EUR",
                },
            };

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product updated successfully");
            expect(mockProduct.price.currency).toBe("EUR");
            expect(mockProduct.price.amount).toBe(100); // Should remain unchanged
        });

        it("should successfully update both price amount and currency", async () => {
            const updateData = {
                price: {
                    amount: 200,
                    currency: "GBP",
                },
            };

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product updated successfully");
            expect(mockProduct.price.amount).toBe(200);
            expect(mockProduct.price.currency).toBe("GBP");
        });

        it("should successfully update multiple fields at once", async () => {
            const updateData = {
                title: "New Title",
                description: "New Description",
                price: {
                    amount: 300,
                    currency: "CAD",
                },
            };

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product updated successfully");
            expect(mockProduct.title).toBe("New Title");
            expect(mockProduct.description).toBe("New Description");
            expect(mockProduct.price.amount).toBe(300);
            expect(mockProduct.price.currency).toBe("CAD");
        });
    });

    // Field Filtering Tests
    describe("Field Filtering", () => {
        beforeEach(() => {
            productModel.findOne.mockResolvedValue(mockProduct);
        });

        it("should ignore non-allowed fields in update", async () => {
            const updateData = {
                title: "Updated Title",
                category: "Should be ignored",
                seller: "Should be ignored",
                createdAt: "Should be ignored",
            };

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(mockProduct.seller).toBe(sellerId); // Should remain unchanged
        });

        it("should handle empty update object gracefully", async () => {
            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Product updated successfully");
            expect(mockProduct.title).toBe("Test Product"); // Should remain unchanged
        });
    });

    // Edge Cases
    describe("Edge Cases", () => {
        beforeEach(() => {
            productModel.findOne.mockResolvedValue(mockProduct);
        });

        it("should handle price amount as string (should convert to number)", async () => {
            const updateData = {
                price: {
                    amount: "250",
                },
            };

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(mockProduct.price.amount).toBe(250);
            expect(typeof mockProduct.price.amount).toBe("number");
        });

        it("should handle partial price updates when price object exists", async () => {
            const updateData = {
                price: {
                    amount: undefined, // Should not update amount
                },
            };

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(mockProduct.price.amount).toBe(100); // Should remain original value
        });

        it("should work with token from cookies", async () => {
            const updateData = { title: "Updated via Cookie" };

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Cookie", `token=${sellerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(mockProduct.title).toBe("Updated via Cookie");
        });
    });

    // Database Error Simulation
    describe("Database Errors", () => {
        it("should handle database save errors gracefully", async () => {
            productModel.findOne.mockResolvedValue(mockProduct);
            mockProduct.save.mockRejectedValue(new Error("Database error"));

            const response = await request(app)
                .patch(`/api/products/${validObjectId}`)
                .set("Authorization", `Bearer ${sellerToken}`)
                .send({ title: "Updated Title" });

            // This should return 500 for internal server error
            expect(response.status).toBe(500);
        });
    });
});
