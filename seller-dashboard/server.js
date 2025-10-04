require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/db/db");
const { connect } = require("./src/broker/broker");
const setListener = require("./src/broker/listeners");

connectDB();

connect().then(() => {
    setListener();
});

app.listen(3007, () => {
    console.log("Seller Dashboard service is running on port: 3007");
});
