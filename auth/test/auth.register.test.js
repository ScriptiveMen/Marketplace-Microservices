const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../src/app"); // <-- your Express app
const User = require("../src/models/user.model");

describe("POST /api/auth/register", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it("should register a new user successfully", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "testuser",
        email: "testuser@example.com",
        password: "Password123!",
        fullName: {
          firstName: "Test",
          lastName: "User",
        },
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/registered sucessfully/i);
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user).toMatchObject({
      username: "testuser",
      email: "testuser@example.com",
      role: "user",
    });

    // ✅ JWT cookie check
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const tokenCookie = cookies.find((c) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();

    // ✅ Verify JWT
    const token = tokenCookie.split("token=")[1].split(";")[0];
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    expect(decoded).toHaveProperty("id");
    expect(decoded.username).toBe("testuser");

    // ✅ DB check
    const user = await User.findOne({ email: "testuser@example.com" }).select(
      "+password"
    );
    expect(user).not.toBeNull();
    expect(user.password).not.toBe("Password123!"); // should be hashed
  });

  it("should return 409 if username already exists", async () => {
    await User.create({
      username: "testuser",
      email: "unique@example.com",
      password: "hashedpassword",
      fullName: { firstName: "Test", lastName: "User" },
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "testuser",
        email: "new@example.com",
        password: "Password123!",
        fullName: {
          firstName: "New",
          lastName: "User",
        },
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("should return 409 if email already exists", async () => {
    await User.create({
      username: "uniqueuser",
      email: "duplicate@example.com",
      password: "hashedpassword",
      fullName: { firstName: "Test", lastName: "User" },
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "newuser",
        email: "duplicate@example.com",
        password: "Password123!",
        fullName: {
          firstName: "New",
          lastName: "User",
        },
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("should return 400 if required fields are missing", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "missing@example.com",
      password: "Password123!",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0]).toHaveProperty("msg");
  });

  it("should return 400 if invalid email is provided", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "invalidemailuser",
        email: "notanemail",
        password: "Password123!",
        fullName: {
          firstName: "Invalid",
          lastName: "Email",
        },
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].msg).toMatch(/invalid email/i);
  });

  it("should set default role to 'user'", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "roleuser",
        email: "roleuser@example.com",
        password: "Password123!",
        fullName: {
          firstName: "Role",
          lastName: "User",
        },
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.user.role).toBe("user");
  });
});
