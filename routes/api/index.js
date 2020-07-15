/*
  Date: 2020-07-15
  Author: ClockworkSquirrel (csqrl)

  Router for handling requests to "/api". See "/controllers/sz.js" for full documentation
  on each route's handler functions.
  
  Overview of Routes:
  - "/locate" ?[ city: string | postcode: string | lat: number && lon: number ]
  - "/stock/:storeId/:styleCode" ?[ quantity: number ]
  - "/product/:styleCode" ?[ storeId: number ] -- Query string ignored as not implemented.
  
  All routes respond with a JSON containing the following fields:
  
  {
    ok: boolean, // Returns true when no errors occur
    result: any // Contains either the result returned by the controller API, or an error message
  }
  
  When an error occurs, the "result" key is usually a string explaining what happened.
  Errors usually serve a status code of 500 (Internal Server Error); however, this does not
  necessarily mean that it *is* a server error - it could be due to user error. 500 just seemed
  like the safest option all-round.
*/
const express = require("express")
const router = express.Router()

const sz = require("../../controllers/sz")

/*
  Store Locator endpoint. Accepts any of: "city", "postcode", "lat"
  or "lon" in the query string.
*/
router.get("/locate", (req, res) => {
  const { city, postcode, lat, lon } = req.query
  
  sz.locateStore({ city, postcode, lat, lon })
    .then(
      storeInfo => res.json({
        ok: true,
        result: storeInfo
      })
    )
    .catch(
      err => res.status(err.statusCode || 500).json({
        ok: false,
        result: err.message
      })
    )
})

/*
  Stock check endpoint. Requires Store ID and style code (including
  size code) in the path. Accepts "quantity" in the query string.
*/
router.get("/stock/:storeId/:styleCode", (req, res) => {
  const { storeId, styleCode } = req.params
  let { quantity } = req.query
  
  // Ensure quantity is always a positive integer - at least 1 or more
  quantity = Math.floor(Math.max(1, quantity))
  
  sz.checkStoreStock({
    storeId,
    styleCode: styleCode.substr(0, 5),
    size: styleCode.substr(-3),
    quantity
  }).then(
    stockInfo => res.json({
      ok: true,
      result: stockInfo
    })
  ).catch(
    err => res.status(err.statusCode || 500).json({
      ok: false,
      result: err.message
    })
  )
})

/*
  Product info endpoint. Requires style code in the path.
*/
router.get("/product/:styleCode", (req, res) => {
  const { styleCode } = req.params
  
  // This is currently unused. It will allow a store's stock levels
  // to be displayed in the response JSON.
  // const { storeId } = req.query
  
  sz.getProductInfo({ styleCode }).then(productInfo => res.json({
    ok: true,
    result: productInfo
  })).catch(err => res.status(err.statusCode || 500).json({
    ok: false,
    result: err.message
  }))
})

module.exports = router