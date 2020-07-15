/*
  Date: 2020-07-15
  Author: ClockworkSquirrel (csqrl)
*/
const express = require("express")
const path = require("path")
const fs = require("../utils/fs")

const router = express.Router()

/*
  Read the contents of the "/routes" directory to dynamically
  create routes from file/directory names, instead of having
  to manually specify.
  
  All other routes should be declared in the `.finally` callback
  of this Promise. This ensures that the dynamic routes are setup
  before other routes; otherwise methods such as `.all("*")` will
  take priority over dynamically-generated ones.
*/
fs.readdir(__dirname, { withFileTypes: true }).then(
  // Remove the "/routes/index.js" file from the Array (this file)
  files => files.filter(file => file.name !== "index.js")
).then(files => 
  files.forEach(file => {
    let filename = file.name
    
    // Remove file extension when not directory
    if (file.isFile()) {
      // Split the filename at each dot into an Array
      filename = filename.split(".")
      
      // Remove the last entry and stitch back together into a string
      filename.pop()
      filename = filename.join(".")
    }
    
    // Set the value of "filename" as the route, and import the module to
    // handle requests
    router.use(`/${filename}`, require(path.join(__dirname, file.name)))
  })
).finally(() => {
  /*
    Handle a request to the base directory with a status of 200 and JSON
    to confirm the API is operational. `Router.all` ensures that the API
    responds to all HTTP methods (e.g. "GET", "POST", "OPTIONS", "HEAD",
    "PUT", "PATCH", "DELETE", etc.), but will still serve the same response
    either way.
  */
  router.all("/", (req, res) => res.json({
    ok: true,
    result: "The server is online"
  }))

  /*
    Handle all other requests with a 404 status and not found response JSON
  */
  router.all("*", (req, res) => res.status(404).json({
    ok: false,
    result: `"${req.path}" was not found on this server`
  }))
})

module.exports = router