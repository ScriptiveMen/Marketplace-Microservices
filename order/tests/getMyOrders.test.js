const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../src/app");

process.env.JWT_SECRET_KEY =
    process.env.JWT_SECRET_KEY || "test-secret-key-123";

function generateAuthToken(userId, role = "user") {
    return jwt.sign({ id: userId, role }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
    });
}

describe("GET /api/orders/me", () => {
    const userId = new mongoose.Types.ObjectId();

    test("returns paginated orders for authenticated user", async () => {
        const token = generateAuthToken(userId.toString(), "user");

        const res = await request(app)
            .get("/api/orders/me?page=1&limit=10")
            .set("Cookie", `token=${token}`);

        // Assert desired contract
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("orders");
        expect(Array.isArray(res.body.orders)).toBe(true);
        expect(res.body).toHaveProperty("page");
        expect(res.body).toHaveProperty("limit");
    });

    test("returns 401 when not authenticated", async () => {
        const res = await request(app).get("/api/orders/me");
        expect(res.status).toBe(401);
    });
});
