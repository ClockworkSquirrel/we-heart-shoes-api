/*
  Date: 2020-07-15
  Author: ClockworkSquirrel (csqrl)
  
  An async, Promise-based implementation of the Node "fs" module
  Documentation: https://nodejs.org/api/fs.html
  
  Supported methods:
  - readdir(path: String | URL | Buffer, options?: String | Object): Promise
*/
const fs = require("fs")

// Reads a directory and returns an Array of filenames (or
// fs.Dirent if `options.withFileTypes === true`)
const readdir = (path, options) => new Promise(
  (resolve, reject) => fs.readdir(path, options, (err, files) => {
    if (err) return reject(err)
    resolve(files)
  })
)

module.exports = {
  readdir
}