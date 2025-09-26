const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app"); // Your Express app
require("dotenv").config();

// Mock User model if needed (adjust according to your actual User model)
const User = require("../src/models/user.model"); // Adjust path as needed

let mongoServer;
let fakeToken;
let userId;
let addressId1;
let addressId2;

beforeAll(async () => {
  // Setup JWT secret
  process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test_secret_key";

  // Close existing connection if any
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Setup MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Create a test user in the database
  const testUser = new User({
    _id: new mongoose.Types.ObjectId("64fae2a1c1234567890abcd1"),
    username: "testuser",
    email: "testuser@example.com",
    fullName: {
      firstName: "Test",
      lastName: "User",
    },
    role: "user",
    addresses: [],
  });

  await testUser.save();
  userId = testUser._id.toString();

  // Create fake token
  const dummyUser = {
    id: userId,
    username: "testuser",
    email: "testuser@example.com",
    fullName: {
      firstName: "Test",
      lastName: "User",
    },
    role: "user",
  };

  fakeToken = jwt.sign(dummyUser, process.env.JWT_SECRET_KEY, {
    expiresIn: "1d",
  });

  global.__MONGOSERVER__ = mongoServer;
});

afterAll(async () => {
  // Clean up test data
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  // Clear addresses before each test
  await User.findByIdAndUpdate(userId, { addresses: [] });
});

describe("Address Management APIs", () => {
  describe("GET /api/auth/users/me/addresses", () => {
    it("should return 401 if no token is provided", async () => {
      const res = await request(app).get("/api/auth/users/me/addresses");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Unauthorized" });
    });

    it("should return 401 if token is invalid", async () => {
      const res = await request(app)
        .get("/api/auth/users/me/addresses")
        .set("Cookie", ["token=invalidtoken"]);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Unauthorized" });
    });

    it("should return empty addresses list for new user", async () => {
      const res = await request(app)
        .get("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("addresses");
      expect(res.body.addresses).toEqual([]);
    });

    it("should return user addresses with default address marked", async () => {
      // First add some addresses to the user
      const address1 = {
        _id: new mongoose.Types.ObjectId(),
        street: "123 Main St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
        isDefault: false,
      };

      const address2 = {
        _id: new mongoose.Types.ObjectId(),
        street: "456 Park Ave",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        country: "India",
        isDefault: true,
      };

      await User.findByIdAndUpdate(userId, {
        addresses: [address1, address2],
      });

      const res = await request(app)
        .get("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.addresses).toHaveLength(2);
      expect(res.body.addresses[1].isDefault).toBe(true);
      expect(res.body.addresses[0].isDefault).toBe(false);
    });
  });

  describe("POST /api/auth/users/me/addresses", () => {
    it("should return 401 if no token is provided", async () => {
      const addressData = {
        street: "123 Test St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
        isDefault: true,
      };

      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .send(addressData);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Unauthorized" });
    });

    it("should return 401 if token is invalid", async () => {
      const addressData = {
        street: "123 Test St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      };

      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", ["token=invalidtoken"])
        .send(addressData);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Unauthorized" });
    });

    it("should add a new address successfully", async () => {
      const addressData = {
        street: "123 Test St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      };

      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`])
        .send(addressData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("message", "Address added successfully");
      expect(res.body).toHaveProperty("address");
      expect(res.body.address).toMatchObject(addressData);
      expect(res.body.address).toHaveProperty("_id");

      addressId1 = res.body.address._id;
    });

    it("should set first address as default", async () => {
      const addressData = {
        street: "123 Test St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      };

      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`])
        .send(addressData);

      expect(res.status).toBe(201);
      expect(res.body.address.isDefault).toBe(true);
    });

    it("should validate required fields", async () => {
      const incompleteAddress = {
        street: "123 Test St",
        city: "Mumbai",
        // Missing state, pincode, country
      };

      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`])
        .send(incompleteAddress);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    it("should validate pincode format", async () => {
      const invalidPincodeAddress = {
        street: "123 Test St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "12345", // Invalid Indian pincode (should be 6 digits)
        country: "India",
      };

      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`])
        .send(invalidPincodeAddress);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toMatch(/pincode/i);
    });

    it("should validate Indian pincode (6 digits)", async () => {
      const validPincodeAddress = {
        street: "123 Test St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      };

      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`])
        .send(validPincodeAddress);

      expect(res.status).toBe(201);
    });

    it("should handle special characters in pincode validation", async () => {
      const invalidPincodeAddress = {
        street: "123 Test St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "40000A",
        country: "India",
      };

      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`])
        .send(invalidPincodeAddress);

      expect(res.status).toBe(400);
    });

    it("should add second address as non-default", async () => {
      // First add one address
      const firstAddress = {
        street: "123 First St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      };

      await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`])
        .send(firstAddress);

      // Add second address
      const secondAddress = {
        street: "456 Second St",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        country: "India",
      };

      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`])
        .send(secondAddress);

      expect(res.status).toBe(201);
      expect(res.body.address.isDefault).toBe(false);
    });

    it("should handle address limit (if any)", async () => {
      // Assuming there's a limit of addresses per user
      const addressData = {
        street: "Test St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      };

      // Add multiple addresses (adjust limit based on your business logic)
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post("/api/auth/users/me/addresses")
            .set("Cookie", [`token=${fakeToken}`])
            .send({
              ...addressData,
              street: `${addressData.street} ${i}`,
            })
        );
      }

      const responses = await Promise.all(promises);

      // Check if there's a limit enforced
      const successfulAdds = responses.filter((res) => res.status === 201);
      const failedAdds = responses.filter((res) => res.status !== 201);

      // This test assumes there might be a limit - adjust based on your logic
      expect(successfulAdds.length).toBeGreaterThan(0);
    });
  });

  describe("DELETE /api/auth/users/me/addresses/:addressId", () => {
    beforeEach(async () => {
      // Add a test address before each delete test
      const addressData = {
        street: "123 Delete Test St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      };

      const res = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`])
        .send(addressData);

      addressId1 = res.body.address._id;
    });

    it("should return 401 if no token is provided", async () => {
      const res = await request(app).delete(
        `/api/auth/users/me/addresses/${addressId1}`
      );

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Unauthorized" });
    });

    it("should return 401 if token is invalid", async () => {
      const res = await request(app)
        .delete(`/api/auth/users/me/addresses/${addressId1}`)
        .set("Cookie", ["token=invalidtoken"]);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Unauthorized" });
    });

    it("should delete address successfully", async () => {
      const res = await request(app)
        .delete(`/api/auth/users/me/addresses/${addressId1}`)
        .set("Cookie", [`token=${fakeToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty(
        "message",
        "Address deleted successfully"
      );
    });

    it("should return 404 for non-existent address", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete(`/api/auth/users/me/addresses/${nonExistentId}`)
        .set("Cookie", [`token=${fakeToken}`]);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message", "Address not found");
    });

    it("should reassign default address when deleting default address", async () => {
      // Add second address
      const secondAddressData = {
        street: "456 Second St",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        country: "India",
      };

      const secondAddressRes = await request(app)
        .post("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`])
        .send(secondAddressData);

      addressId2 = secondAddressRes.body.address._id;

      // Delete the first (default) address
      const deleteRes = await request(app)
        .delete(`/api/auth/users/me/addresses/${addressId1}`)
        .set("Cookie", [`token=${fakeToken}`]);

      expect(deleteRes.status).toBe(200);

      // Check if second address became default
      const addressesRes = await request(app)
        .get("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`]);

      expect(addressesRes.body.addresses).toHaveLength(1);
      expect(addressesRes.body.addresses[0].isDefault).toBe(true);
    });

    it("should handle deleting the only address", async () => {
      const res = await request(app)
        .delete(`/api/auth/users/me/addresses/${addressId1}`)
        .set("Cookie", [`token=${fakeToken}`]);

      expect(res.status).toBe(200);

      // Verify no addresses left
      const addressesRes = await request(app)
        .get("/api/auth/users/me/addresses")
        .set("Cookie", [`token=${fakeToken}`]);

      expect(addressesRes.body.addresses).toHaveLength(0);
    });

    it("should not allow deleting another user's address", async () => {
      // Create another user
      const anotherUser = new User({
        _id: new mongoose.Types.ObjectId(),
        username: "anotheruser",
        email: "another@example.com",
        role: "user",
        fullName: {
          firstName: "Another",
          lastName: "User",
        },
        addresses: [
          {
            _id: new mongoose.Types.ObjectId(),
            street: "999 Other St",
            city: "Kolkata",
            state: "West Bengal",
            pincode: "700001",
            country: "India",
            isDefault: true,
          },
        ],
      });

      await anotherUser.save();
      const otherUserAddressId = anotherUser.addresses[0]._id;

      // Try to delete another user's address
      const res = await request(app)
        .delete(`/api/auth/users/me/addresses/${otherUserAddressId}`)
        .set("Cookie", [`token=${fakeToken}`]);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message", "Address not found");
    });
  });
});
