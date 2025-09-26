// auth.logout.test.js
const jwt = require("jsonwebtoken");
const request = require("supertest");

// ✅ Completely mock Redis client before importing app
jest.mock("../src/db/redis", () => {
  return {
    set: jest.fn().mockResolvedValue("OK"),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue("OK"), // add quit() to close gracefully
  };
});

const redis = require("../src/db/redis");
const app = require("../src/app"); // Import AFTER Redis is mocked

describe("GET /api/auth/logout", () => {
  let validToken;

  beforeAll(() => {
    process.env.JWT_SECRET_KEY =
      process.env.JWT_SECRET_KEY || "test_secret_key";

    const dummyUser = {
      id: "64fae2a1c1234567890abcd1",
      username: "testuser",
      email: "testuser@example.com",
      role: "user",
    };

    validToken = jwt.sign(dummyUser, process.env.JWT_SECRET_KEY, {
      expiresIn: "1d",
    });
  });

  afterAll(async () => {
    // Clear mocks and close dummy redis
    jest.clearAllMocks();
    if (redis.quit) {
      await redis.quit(); // ensure Jest detects no open handles
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should logout user and blacklist token in Redis", async () => {
    const res = await request(app)
      .get("/api/auth/logout")
      .set("Cookie", [`token=${validToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logout|success/i);
    expect(redis.set).toHaveBeenCalledWith(
      `blacklist:${validToken}`,
      "true",
      "EX",
      24 * 60 * 60
    );
  });

  it("should return 401 if no token is provided", async () => {
    const res = await request(app).get("/api/auth/logout");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/unauthorized|no.*token/i);
  });
});
