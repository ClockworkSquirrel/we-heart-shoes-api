/*
  Author: ClockworkSquirrel (csqrl)
  Date: 2020-07-15
  
  Custom Error class for returning a HTTP Status Code.
  
  Overview of Methods:
  - constructor(message?: string = "", statusCode?: number = 500)
*/

class HttpError extends Error {
  constructor(message, statusCode) {
    super(message)
    
    if (Error.captureStackTrace)
      Error.captureStackTrace(this, HttpError)
    
    this.name = "HttpError"
    this.statusCode = statusCode
    this.date = new Date()
  }
}

module.exports = {
  HttpError
}