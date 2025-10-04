require("dotenv").config();
const app = require("./src/app");
const { connect } = require("./src/broker/broker");
const setListeners = require("./src/broker/listeners");

connect().then(() => {
    setListeners();
});

app.listen(3006, () => {
    console.log("Notification service is running on port: 3006");
});
