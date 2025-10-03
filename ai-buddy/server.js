require("dotenv").config();
const app = require("./src/app");
const http = require("http");
const httpServer = http.createServer(app);
const { initSocketServer } = require("./src/sockets/socket.server");

initSocketServer(httpServer);

httpServer.listen(3005, () => {
    console.log("AI-Buddy service is running on port 3005");
});
