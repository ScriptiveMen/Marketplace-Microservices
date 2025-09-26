const { Redis } = require("ioredis");

let redis;

if (process.env.NODE_ENV === "test") {
  // ✅ Fake client for Jest tests (no real connection)
  redis = {
    set: jest.fn().mockResolvedValue("OK"),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue("OK"),
    on: jest.fn(), // so `redis.on("connect")` won’t break
  };
} else {
  // ✅ Real Redis connection for dev/prod
  redis = new Redis({
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD,
    port: process.env.REDIS_PORT,
  });

  redis.on("connect", () => {
    console.log("Connected to Redis");
  });
}

module.exports = redis;
