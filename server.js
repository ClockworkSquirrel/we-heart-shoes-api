/*
  Date: 2020-07-15
  Author: ClockworkSquirrel (csqrl)
*/
const express = require("express")
const path = require("path")
const cors = require("cors")
const app = express()

// Allow requests from remote clients/servers
app.use(cors())

// Handle routing by initiating "routes/index.js"
app.use(require(path.join(__dirname, "routes")))

// Start the server on the port specified in ".env"
app.listen(process.env.PORT)