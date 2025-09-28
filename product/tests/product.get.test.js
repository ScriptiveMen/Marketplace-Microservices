const request = require("supertest");
const app = require("../src/app"); // Adjust path to your main app file
const productModel = require("../src/models/product.model"); // Adjust path

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

describe("GET /api/products", () => {
    let mockProducts;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Sample mock products data
        mockProducts = [
            {
                _id: "507f1f77bcf86cd799439011",
                title: "Product 1",
                description: "Description 1",
                price: { amount: 100, currency: "INR" },
                seller: "507f1f77bcf86cd799439012",
                images: [],
            },
            {
                _id: "507f1f77bcf86cd799439013",
                title: "Product 2",
                description: "Description 2",
                price: { amount: 200, currency: "INR" },
                seller: "507f1f77bcf86cd799439014",
                images: [],
            },
            {
                _id: "507f1f77bcf86cd799439015",
                title: "Laptop Computer",
                description: "High-performance laptop",
                price: { amount: 50000, currency: "INR" },
                seller: "507f1f77bcf86cd799439016",
                images: [],
            },
        ];

        // Setup default mock chain
        productModel.find = jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockProducts),
            }),
        });
    });

    describe("Basic functionality", () => {
        test("should return all products with default pagination", async () => {
            const response = await request(app)
                .get("/api/products")
                .expect(200);

            expect(response.body).toHaveProperty("data");
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data).toEqual(mockProducts);

            // Verify model was called with correct parameters
            expect(productModel.find).toHaveBeenCalledWith({});
            expect(productModel.find().skip).toHaveBeenCalledWith(0);
            expect(productModel.find().skip().limit).toHaveBeenCalledWith(20);
        });

        test("should handle empty product list", async () => {
            productModel.find = jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([]),
                }),
            });

            const response = await request(app)
                .get("/api/products")
                .expect(200);

            expect(response.body.data).toEqual([]);
        });
    });

    describe("Search functionality", () => {
        test("should filter products by search query", async () => {
            const filteredProducts = [mockProducts[2]]; // Laptop product
            productModel.find = jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue(filteredProducts),
                }),
            });

            const response = await request(app)
                .get("/api/products?q=laptop")
                .expect(200);

            expect(response.body.data).toEqual(filteredProducts);
            expect(productModel.find).toHaveBeenCalledWith({
                $text: { $search: "laptop" },
            });
        });

        test("should handle search with no results", async () => {
            productModel.find = jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([]),
                }),
            });

            const response = await request(app)
                .get("/api/products?q=nonexistent")
                .expect(200);

            expect(response.body.data).toEqual([]);
            expect(productModel.find).toHaveBeenCalledWith({
                $text: { $search: "nonexistent" },
            });
        });

        test("should handle empty search query", async () => {
            const response = await request(app)
                .get("/api/products?q=")
                .expect(200);

            // Empty string should not add $text filter
            expect(productModel.find).toHaveBeenCalledWith({});
        });
    });

    describe("Price filtering", () => {
        test("should filter products by minimum price", async () => {
            const expensiveProducts = [mockProducts[1], mockProducts[2]];
            productModel.find = jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue(expensiveProducts),
                }),
            });

            const response = await request(app)
                .get("/api/products?minprice=150")
                .expect(200);

            expect(response.body.data).toEqual(expensiveProducts);
            expect(productModel.find).toHaveBeenCalledWith({
                "price.amount": { $gte: 150 },
            });
        });

        test("should filter products by maximum price", async () => {
            const cheapProducts = [mockProducts[0], mockProducts[1]];
            productModel.find = jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue(cheapProducts),
                }),
            });

            const response = await request(app)
                .get("/api/products?maxprice=300")
                .expect(200);

            expect(response.body.data).toEqual(cheapProducts);
            expect(productModel.find).toHaveBeenCalledWith({
                "price.amount": { $lte: 300 },
            });
        });

        test("should filter products by price range", async () => {
            const midRangeProducts = [mockProducts[1]];
            productModel.find = jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue(midRangeProducts),
                }),
            });

            const response = await request(app)
                .get("/api/products?minprice=150&maxprice=300")
                .expect(200);

            expect(response.body.data).toEqual(midRangeProducts);
            expect(productModel.find).toHaveBeenCalledWith({
                "price.amount": { $gte: 150, $lte: 300 },
            });
        });

        test("should handle invalid price values", async () => {
            const response = await request(app)
                .get("/api/products?minprice=invalid&maxprice=notanumber")
                .expect(200);

            // NaN values should still be passed to the model
            expect(productModel.find).toHaveBeenCalledWith({
                "price.amount": { $gte: NaN, $lte: NaN },
            });
        });
    });

    describe("Pagination", () => {
        test("should handle custom skip parameter", async () => {
            const response = await request(app)
                .get("/api/products?skip=10")
                .expect(200);

            expect(productModel.find().skip).toHaveBeenCalledWith(10);
            expect(productModel.find().skip().limit).toHaveBeenCalledWith(20);
        });

        test("should handle custom limit parameter", async () => {
            const response = await request(app)
                .get("/api/products?limit=5")
                .expect(200);

            expect(productModel.find().skip).toHaveBeenCalledWith(0);
            expect(productModel.find().skip().limit).toHaveBeenCalledWith(5);
        });

        test("should limit maximum results to 20", async () => {
            const response = await request(app)
                .get("/api/products?limit=100")
                .expect(200);

            expect(productModel.find().skip().limit).toHaveBeenCalledWith(20);
        });

        test("should handle custom skip and limit together", async () => {
            const response = await request(app)
                .get("/api/products?skip=5&limit=10")
                .expect(200);

            expect(productModel.find().skip).toHaveBeenCalledWith(5);
            expect(productModel.find().skip().limit).toHaveBeenCalledWith(10);
        });

        test("should handle invalid pagination parameters", async () => {
            const response = await request(app)
                .get("/api/products?skip=invalid&limit=notanumber")
                .expect(200);

            expect(productModel.find().skip).toHaveBeenCalledWith(NaN);
            expect(productModel.find().skip().limit).toHaveBeenCalledWith(NaN); // Math.min(NaN, 20) = NaN
        });
    });

    describe("Combined filters", () => {
        test("should handle search with price range and pagination", async () => {
            const response = await request(app)
                .get(
                    "/api/products?q=laptop&minprice=1000&maxprice=100000&skip=2&limit=5"
                )
                .expect(200);

            expect(productModel.find).toHaveBeenCalledWith({
                $text: { $search: "laptop" },
                "price.amount": { $gte: 1000, $lte: 100000 },
            });
            expect(productModel.find().skip).toHaveBeenCalledWith(2);
            expect(productModel.find().skip().limit).toHaveBeenCalledWith(5);
        });

        test("should handle all query parameters together", async () => {
            const response = await request(app)
                .get(
                    "/api/products?q=product&minprice=50&maxprice=500&skip=1&limit=15"
                )
                .expect(200);

            expect(productModel.find).toHaveBeenCalledWith({
                $text: { $search: "product" },
                "price.amount": { $gte: 50, $lte: 500 },
            });
            expect(productModel.find().skip).toHaveBeenCalledWith(1);
            expect(productModel.find().skip().limit).toHaveBeenCalledWith(15);
        });
    });

    describe("Error handling", () => {
        test("should handle database errors", async () => {
            const errorMessage = "Database connection error";
            productModel.find = jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockRejectedValue(new Error(errorMessage)),
                }),
            });

            // Note: Your current implementation doesn't have explicit error handling
            // This test assumes the error would bubble up and cause a 500 response
            // You may need to adjust based on your actual error handling
            const response = await request(app).get("/api/products");

            // This might be 500 if you have global error handling middleware
            expect(response.status).toBe(500);
        });

        test("should handle malformed query parameters gracefully", async () => {
            const response = await request(app)
                .get(
                    "/api/products?skip=abc&limit=def&minprice=xyz&maxprice=123abc"
                )
                .expect(200);

            // Should still call the model even with invalid parameters
            expect(productModel.find).toHaveBeenCalled();
        });
    });

    describe("Response format", () => {
        test("should return correct response structure", async () => {
            const response = await request(app)
                .get("/api/products")
                .expect(200);

            expect(response.body).toHaveProperty("data");
            expect(Array.isArray(response.body.data)).toBe(true);

            if (response.body.data.length > 0) {
                const product = response.body.data[0];
                expect(product).toHaveProperty("_id");
                expect(product).toHaveProperty("title");
                expect(product).toHaveProperty("price");
                expect(product.price).toHaveProperty("amount");
                expect(product.price).toHaveProperty("currency");
            }
        });

        test("should return products with all expected fields", async () => {
            const response = await request(app)
                .get("/api/products")
                .expect(200);

            if (response.body.data.length > 0) {
                const product = response.body.data[0];
                expect(typeof product._id).toBe("string");
                expect(typeof product.title).toBe("string");
                expect(typeof product.price.amount).toBe("number");
                expect(typeof product.price.currency).toBe("string");
                expect(Array.isArray(product.images)).toBe(true);
            }
        });
    });
});
