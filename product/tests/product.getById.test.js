const request = require("supertest");
const app = require("../src/app"); // Adjust path to your main app file
const productModel = require("../src/models/product.model"); // Adjust path
const mongoose = require("mongoose");

// Mock the product model
jest.mock("../src/models/product.model");

// Mock uuid to avoid ES module issues
jest.mock("uuid", () => ({
    v4: () => "mocked-uuid",
}));

// Mock imagekit service to avoid the uuid dependency
jest.mock("../src/services/imagekit.service", () => ({
    uploadImage: jest.fn().mockResolvedValue("mocked-image-url"),
}));

describe("GET /api/products/:id", () => {
    let mockProduct;
    let validObjectId;
    let invalidObjectId;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Generate valid ObjectIds for testing
        validObjectId = "507f1f77bcf86cd799439011";
        invalidObjectId = "invalid-id";

        // Sample mock product data
        mockProduct = {
            _id: validObjectId,
            title: "Test Product",
            description: "A test product description",
            price: {
                amount: 1500,
                currency: "INR",
            },
            seller: "507f1f77bcf86cd799439012",
            images: [
                "https://example.com/image1.jpg",
                "https://example.com/image2.jpg",
            ],
            createdAt: "2024-01-01T00:00:00.000Z", // String instead of Date object
            updatedAt: "2024-01-01T00:00:00.000Z",
        };

        // Setup default mock
        productModel.findById = jest.fn();
    });

    describe("Successful requests", () => {
        test("should return a product when valid ID is provided", async () => {
            productModel.findById.mockResolvedValue(mockProduct);

            const response = await request(app)
                .get(`/api/products/${validObjectId}`)
                .expect(200);

            expect(response.body).toHaveProperty("product");
            expect(response.body.product).toEqual(mockProduct);
            expect(productModel.findById).toHaveBeenCalledWith(validObjectId);
            expect(productModel.findById).toHaveBeenCalledTimes(1);
        });

        test("should return product with all expected fields", async () => {
            productModel.findById.mockResolvedValue(mockProduct);

            const response = await request(app)
                .get(`/api/products/${validObjectId}`)
                .expect(200);

            const product = response.body.product;
            expect(product).toHaveProperty("_id");
            expect(product).toHaveProperty("title");
            expect(product).toHaveProperty("description");
            expect(product).toHaveProperty("price");
            expect(product).toHaveProperty("seller");
            expect(product).toHaveProperty("images");
            expect(product.price).toHaveProperty("amount");
            expect(product.price).toHaveProperty("currency");
        });

        test("should return product with correct data types", async () => {
            productModel.findById.mockResolvedValue(mockProduct);

            const response = await request(app)
                .get(`/api/products/${validObjectId}`)
                .expect(200);

            const product = response.body.product;
            expect(typeof product._id).toBe("string");
            expect(typeof product.title).toBe("string");
            expect(typeof product.description).toBe("string");
            expect(typeof product.price.amount).toBe("number");
            expect(typeof product.price.currency).toBe("string");
            expect(typeof product.seller).toBe("string");
            expect(Array.isArray(product.images)).toBe(true);
        });

        test("should return product with empty images array", async () => {
            const productWithoutImages = { ...mockProduct, images: [] };
            productModel.findById.mockResolvedValue(productWithoutImages);

            const response = await request(app)
                .get(`/api/products/${validObjectId}`)
                .expect(200);

            expect(response.body.product.images).toEqual([]);
        });
    });

    describe("Product not found", () => {
        test("should return 404 when product does not exist", async () => {
            productModel.findById.mockResolvedValue(null);

            const response = await request(app)
                .get(`/api/products/${validObjectId}`)
                .expect(404);

            expect(response.body).toHaveProperty("message");
            expect(response.body.message).toBe("Product not found");
            expect(productModel.findById).toHaveBeenCalledWith(validObjectId);
        });
    });

    describe("Edge cases", () => {
        test("should handle product with null description", async () => {
            const productWithNullDescription = {
                ...mockProduct,
                description: null,
            };
            productModel.findById.mockResolvedValue(productWithNullDescription);

            const response = await request(app)
                .get(`/api/products/${validObjectId}`)
                .expect(200);

            expect(response.body.product.description).toBeNull();
        });
    });
});
