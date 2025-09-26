const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../src/app"); // <-- your Express app
const User = require("../src/models/user.model");

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await User.deleteMany({});
    // create a test user
    const hashed = await bcrypt.hash("Password123!", 10);
    await User.create({
      username: "loginuser",
      email: "login@example.com",
      password: hashed,
      fullName: { firstName: "Login", lastName: "User" },
    });
  });

  it("should login successfully with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "Password123!",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/login successful/i);

    // ✅ JWT cookie should be set
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const tokenCookie = cookies.find((c) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();

    // ✅ Verify JWT token
    const token = tokenCookie.split("token=")[1].split(";")[0];
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    expect(decoded).toHaveProperty("id");
    expect(decoded.email).toBe("login@example.com");
  });

  it("should return 401 for invalid password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "WrongPassword!",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it("should return 401 for non-existing user", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nouser@example.com",
      password: "Password123!",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it("should return 400 if email is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({
      password: "Password123!",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it("should return 400 if password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it("should return 400 if email format is invalid", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "notanemail",
      password: "Password123!",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].msg).toMatch(/invalid email/i);
  });
});
