const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

// Start in-memory mongo and connect mongoose before running tests
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGO_URI = uri;

    // Connect without deprecated options
    await mongoose.connect(uri);
});

// Clear database between tests
beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
        await collection.deleteMany();
    }
});

// Stop mongo and disconnect mongoose after tests
afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
});
