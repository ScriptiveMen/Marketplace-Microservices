const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app"); // Your Express app
require("dotenv").config();

describe("GET /api/auth/me", () => {
  let fakeToken;

  beforeAll(() => {
    // Create a fake token with dummy user data
    const dummyUser = {
      id: "64fae2a1c1234567890abcd1",
      username: "testuser",
      email: "testuser@example.com",
      role: "user",
    };

    fakeToken = jwt.sign(dummyUser, process.env.JWT_SECRET_KEY, {
      expiresIn: "1d",
    });
  });

  it("should return 401 if no token is provided", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  it("should return 200 and user data if valid token is provided", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [`token=${fakeToken}`]); // Set the token in cookie

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "User fetched sucessfully");
    expect(res.body).toHaveProperty("user");
    expect(res.body.user).toMatchObject({
      id: "64fae2a1c1234567890abcd1",
      username: "testuser",
      email: "testuser@example.com",
      role: "user",
    });
  });

  it("should return 401 if token is invalid", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", ["token=invalidtoken"]);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });
});
