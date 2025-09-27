const request = require("supertest");
const app = require("../src/app");

// Mock ImageKit service
jest.mock("../src/services/imagekit.service", () => ({
    uploadFile: jest.fn(),
}));

// Mock the entire auth middleware file
jest.mock("../src/middlewares/auth.middleware", () => {
    // Return a function that returns the middleware (matching your createAuthMiddleware structure)
    return jest.fn(() => {
        return (req, res, next) => {
            req.user = {
                id: "test-user-id",
                email: "test@example.com",
                role: "seller",
            };
            next();
        };
    });
});

// Mock the product model
jest.mock("../src/models/product.model", () => ({
    create: jest.fn(),
}));

const { uploadFile } = require("../src/services/imagekit.service");
const productModel = require("../src/models/product.model");

describe("POST /api/products", () => {
    beforeEach(() => {
        uploadFile.mockReset();
        productModel.create.mockReset();
    });

    test("creates product successfully", async () => {
        // Mock product creation
        productModel.create.mockResolvedValue({
            id: "test-product-id",
            title: "Test Product",
            description: "A test product",
            price: { amount: 1000, currency: "INR" },
            seller: "test-user-id",
            images: [],
        });

        const res = await request(app)
            .post("/api/products")
            .field("title", "Test Product")
            .field("description", "A test product")
            .field("priceAmount", "1000")
            .field("priceCurrency", "INR");

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.title).toBe("Test Product");
        expect(res.body.price.amount).toBe(1000);
        expect(res.body.price.currency).toBe("INR");
        expect(productModel.create).toHaveBeenCalledWith({
            title: "Test Product",
            description: "A test product",
            price: { amount: 1000, currency: "INR" },
            seller: "test-user-id",
            images: [],
        });
    });

    test("uploads image successfully", async () => {
        // Mock uploadFile response
        uploadFile.mockResolvedValue({
            url: "https://example.com/image.jpg",
            thumbnail: "https://example.com/thumb.jpg",
            id: "abc123",
        });

        // Mock product creation with image
        productModel.create.mockResolvedValue({
            id: "test-product-id",
            title: "Product with Image",
            price: { amount: 500, currency: "INR" },
            seller: "test-user-id",
            images: [
                {
                    url: "https://example.com/image.jpg",
                    thumbnail: "https://example.com/thumb.jpg",
                    id: "abc123",
                },
            ],
        });

        const buffer = Buffer.from("fake image content");
        const res = await request(app)
            .post("/api/products")
            .field("title", "Product with Image")
            .field("priceAmount", "500")
            .attach("image", buffer, {
                filename: "test.jpg",
                contentType: "image/jpeg",
            });

        expect(res.statusCode).toBe(201);
        expect(uploadFile).toHaveBeenCalledWith({
            fileBuffer: expect.any(Buffer),
        });
        expect(res.body.images).toHaveLength(1);
        expect(res.body.images[0]).toMatchObject({
            url: "https://example.com/image.jpg",
            thumbnail: "https://example.com/thumb.jpg",
            id: "abc123",
        });
    });

    test("validates required fields", async () => {
        const res = await request(app)
            .post("/api/products")
            .send({ description: "Missing required fields" });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Validation errors");
        expect(res.body.errors).toBeDefined();
        expect(Array.isArray(res.body.errors)).toBe(true);
    });
});
