const express = require("express");

const app = express();

app.get("/", (req, res) => {
    res.status(200).json({
        message: "Notification service is running",
    });
});

module.exports = app;
