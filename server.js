/*
  Date: 2020-07-15
  Author: ClockworkSquirrel (csqrl)
*/
const express = require("express")
const path = require("path")
const app = express()

// Handle routing by initiating "routes/index.js"
app.use(require(path.join(__dirname, "routes")))

// Start the server on the port specified in ".env"
app.listen(process.env.PORT)