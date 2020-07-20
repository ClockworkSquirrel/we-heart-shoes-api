/*
  Date: 2020-07-15
  Author: ClockworkSquirrel (csqrl)

  Controller for interfacing with the Shoe Zone website and APIs.
  
  Available methods:
  - locateStore({ lat?: number = 0, lon?: number = 0, postcode?: string = "", city?: string = "" }): Promise<Object>
  - checkStoreStock({ styleCode: number, size: string, storeId: number, quantity?: number = 1 }): Promise<Object>
  - getProductInfo({ styleCode: number }): Promise<Object>
  
  All methods take their parameters as Objects with the keys described above, including methods which
  only take a single argument. This is for consistency across the controller's API.
*/

const URL = require("url").URL
const axios = require("axios")
const { JSDOM } = require("jsdom")
const fcache = require("flat-cache")
const { HttpError } = require("../utils/HttpError")

/*
  Convert the environment's SZAPI string into a URL object. This is useful if the URL changes from
  the default "shoezone.com" address, as it will allow easy access to the "origin" property,
  for making web requests.
*/
const szURL = new URL(process.env.SZAPI)

/*
  Caching allows the server to respond to requests faster that have previously already been made.
  This Object stores the reference to the different cache files used throughout the API controller.
  
  locator: Stores a copy of store information for locating the user.
  products: Stores information pertaining to products
*/
const cache = {
  locator: fcache.load("store-locator-api.json", "./_cache"),
  products: fcache.load("product-api.json", "./_cache")
}

/*
  The following Array contains a list of ignored strings when abbreviating offers. This is necessary
  as sometimes product pages display badges such as "Memory Foam Insoles" where offer icons would
  usually be. Unfortunately, there is nothing to differentiate these badges from actual offers, and
  therefore we must manually specify which "offers" to ignore.
  
  This list is not case-senstive, but the name must exactly match that of the [title] attribute
  of the offer badge.
*/
const ignoredOffers = [
  "memory foam"
]

/*
  Public method:
  locateStore({ city?: string = "", postcode?: string = "", lat?: number = 0, lon?: number = 0 }): Promise<Object>

  Find a store given either the City, Postcode or Latitude and Longitude.
  Uses the StoreLocator widget API; returns a Promise which resolves with
  an Object containing the following data:
  
  {
    storeName: string,
    storeId: number,
    storeAddress: string,
    storePhone: string
  }
*/
function locateStore({ lat, lon, city, postcode }) {
  // If specified, truncate lat/lon to 2 decimal places. This should be
  // an appropriate accuracy to use.
  lat = (Number(lat) || 0).toFixed(2), lon = (Number(lon) || 0).toFixed(2)
  
  // Check for an entry in the cache before making a request to the API
  // The key is composed of the supplied data, transformed into a CSV
  const cacheKey = `near:${[ lat, lon, city, postcode ].filter(v => v !== undefined).map(v => String(v).toLowerCase()).join(",")}`
  const cachedValue = cache.locator.getKey(cacheKey)
  
  if (cachedValue)
    return Promise.resolve(cachedValue)
  
  // Make a POST request to the StoreLocator API, using the arguments
  // provided above
  return axios.post(`${process.env.SZAPI}/StoreLocator.aspx/FindRequestedStores`, {
      "_sRequestJSON": `{
        "Town": "${city || ""}",
        "PostCode": "${postcode ? postcode.split(" ").join("").toUpperCase() : ""}",
        "Latitude": ${lat},
        "Longitude": ${lon},
        "StartDistance": 0,
        "NumberOfStores": 1
      }`
  }, {
    headers: {
      origin: szURL.origin
    }
  })
  // The response is stored within the "d" key of the returned JSON as a
  // stringified Object
  .then(({ data }) => JSON.parse(data.d))
  .then(({ Stores, ErrorMsg }) => {
    // If no stores are found, throw an error
    if (Stores === null && ErrorMsg)
      throw new HttpError(ErrorMsg, 400)
    
    // We only asked for one store, so we only need the first entry in the Array
    return Stores[0]
  })
  // Return an Object containing the information that we need
  .then(data => ({
    storeName: data.DisplayLine1.toLowerCase().split(" ").map(
      word => `${word[0].toUpperCase()}${word.substr(1)}`
    ).join(" "),
    storeId: Number(data.Key),
    storeAddress: `${data.Property}, ${data.Street}, ${data.PostCode}`,
    storePhone: data.Telephone.split(" ").join("")
  })).then(data => {
    cache.locator.setKey(cacheKey, data)
    cache.locator.save(true)
    
    return data
  })
}

/*
  Public method:
  checkStoreStock({ styleCode: number, size: string, storeId: number, quantity?: number = 1 }): Promise<Object>

  Check whether the specified store has the specified product in stock. Returns a
  Promise which resolves with the following object:
  
  {
    inStock: boolean,
    storeName: string,
    storeId: number,
    storeAddress: string
  }
  
  Due to limitations in Shoe Zone's own API, this method is only capable of checking a single size
  of a single style at a time. There is no way to determine quantities of stock, due to the API
  only returning a boolean value -- the only workaround would be incrementally checking quantities
  until the API returns false; however, this would most definitely spam the Shoe Zone servers (especially
  if a store has 500+ pairs in stock), and may even cause a DOS attack. This method will be revisited
  if Shoe Zone decided to provide an API which is capable of returning stock levels per store.
*/
function checkStoreStock({ styleCode, size, storeId, quantity = 1 }) {
  // Make a POST request to the Stock Checker API, using the arguments provided above.
  return axios.post(`${process.env.SZAPI}/Product.aspx/StoreStockAjaxRequest`, {
    // The "data" key of the request body contains a stringified JSON with the
    // required information. Each key is mapped to an Object containing key-value
    // pairs of "val" - the value of the key. For some reason, we need to specify
    // "hasStockInWH", even though this has nothing to do with the warehouse
    "data": `{
      '_prod_CCStoreNo': { 'val': '${storeId}', 'err': '' },
      '_prod_SizeId': { 'val': '${styleCode}${size}', 'err': '' },
      '_prod_Qty': { 'val': '${quantity || 1}', 'err': '' },
      '_prod_hasStockInWH': { 'val': 'true', 'err': '' },
      '_prod_Action': { 'val': 'getStoreStock', 'err': '' }
    }`
  }, {
    headers: {
      origin: szURL.origin
    }
  })
  // The response is stored within the "d" key of the returned JSON with
  // the data we need stored within a stringified JSON Object under the
  // "data" key
  .then(({ data }) => JSON.parse(data.d.data))
  .then(data => {
    // The API still responds with a 200 status even if the product code
    // is wrong (or doesn't exist). We need to check for the "_prod_sNo_Stock"
    // key to determine if there was an error or not
    if (data._prod_sNo_Stock)
      return data._prod_sNo_Stock
    
    // If the API didn't return any usable data, throw an error
    throw new Error("Product unavailable")
  })
  // Return an Object containing the data we need
  .then(data => ({
    inStock: data.HasStock,
    storeName: data.StoreName,
    storeId: data.StoreNo,
    storeAddress: data.StoreAddress
  }))
}

/*
  Private method:
  fetchWebpage(pathname?: string = "/", cacheTTL?: number = 31536000): Promise<Object{
    result: JSDOM | any,
    setCache: function<void>(value: any)
  }>
  
  Will fetch a page from the Shoe Zone website, given a pathname, using a basic GET request.
  The returned Promise will resolve with a JSDOM object. Manipulation can be performed
  as if used in the browser (thanks to the JSDOM library).
  
  `cacheTTL` determines how long the cached value will be stored before it expires. Setting
  this to `false` will ignore the cached value when fetching a webpage. As of 2020-07-20,
  this method no longer caches the resulting HTML, and instead returns an Object which contains
  a `setCache` callback, taking a single "value" parameter. Call this to set the content of
  the cache to return when the same URL is requested. If cacheTTL was falsey when the webpage
  was fetched, the setCache callback will return instantly to prevent setting cached data.
*/
function fetchWebpage(pathname = "/", cacheTTL = 31536000) {
  // The key which data will be indexed under by the cache
  const cacheKey = `page@sz:${pathname.toLowerCase()}`
  
  if (cacheTTL) {
    // Check the cache for an entry matching the requested path
    const cachedValue = cache.products.getKey(cacheKey)
    
    if (cachedValue && cachedValue.timestamp && (Date.now() - cachedValue.timestamp < cacheTTL))
      return Promise.resolve({ result: cachedValue.value, cached: true })
  }
  
  // Use JSDOM's `fromURL` convenience method to download and parse the HTML
  // content of the requested page
  return JSDOM.fromURL(`${process.env.SZSITE}${pathname}`).then(jsdom => {
    return { result: jsdom, cached: false, setCache: value => {
      if (!cacheTTL) return
      
      cache.products.setKey(cacheKey, { timestamp: Date.now(), value })
      cache.products.save(true)
    }}
  })
}

/*
  Private method:
  abbreviateOffer(offer: string): string
  
  Generate an abbreviation for a given offer; e.g. "Buy One Get One Free" would
  become "BOGOF". Single-word offer names will not be abbreviated; e.g. "Save"
  becomes "SAVE".
*/
function abbreviateOffer(offer) {
  /*
    If the offer name is only a single word, there doesn't seem much need to abbreviate.
    This would most likely cause confusion when abbreviating an offer such as "Save" to "S",
    as it would be anyone's guess what "S" stands for. Otherwise, split the string into an
    Array at any non-alphanumeric characters, including punctuation and whitespace.
  */
  return offer.trim().indexOf(" ") === -1 ? offer.toUpperCase() : offer.split(/[^A-Z0-9]/gi)
    // Remove any zero-length strings from the Array
    .filter(word => word.length)
    /*
      Iterate through each word in the resulting Array. If the word is "for", convert it to
      "-4-". The likelyhood is that this is an offer such as "2 For £10", and will become abbreviated
      to "2-4-10". If not, capitalise the first letter of the word, and remove all other alphabetic
      characters.
    */
    .map(word => word.toLowerCase() === "for" ? "-4-" : `${word[0].toUpperCase()}${word.substr(1).replace(/[A-Z]/gi, "")}`)
    // Stitch the Array back into a single string
    .join("")
}


/*
  Public method:
  getProductInfo({ styleCode: number, storeId?: number }): Promise<Object>
  
  Downloads a copy of the product page from the Shoe Zone website and scrapes
  information from the HTML content. Returns a promise which resolves with the
  following Object:
  
  {
    id: number,
    name: string,
    price: { current: number },
    currency: string,
    thumbnail: string,
    categories: string[],
    storeId: number, // NOT IMPLEMENTED - See notes.
    sizeRange: {
      size: string,
      stock: {
        warehouse: number,
        store: number // NOT IMPLEMENTED - See notes.
      },
      code: string
    },
    offers: string[]
  }
  
  Note: The StoreId is an unused parameter, but hopefully an API will be implemented on Shoe Zone's
  servers eventually that will allow a specific store's stock levels to be checked. When this API does
  come to fruition, stock quantities will be output in the `sizeRange` key of the resulting Object.
  There will additionally be a `storeId` key in the resulting Object to reflect which store the stock
  levels have been retrieved from.
*/
function getProductInfo({ styleCode, storeId }) {
  /*
    As of 2020-07-19, product codes may be up to 6-digits long. This means we now need
    to appropriately handle product codes with more than 5 digits. Size codes are still
    currently only 3 digits long.
    
    We can determine if a styleCode also contains a size code and truncate it by
    subtracting 3 from its length. If length-3 is greater than or equal to 5, then
    it most likely contains a size code too, and we should remove the last 3
    characters.
    
    If no size code was appended to the style code, then subtracting 3 will result
    in a value less than 5 (the minimum length of a style code).
  */
  if (styleCode.length - 3 >= 5)
    styleCode = styleCode.substr(0, styleCode.length - 3)
  
  // Fetch the product page from the Shoe Zone website. This calls the `fetchWebpage`
  // method, which is documented above. The resolved value is a JSDOM object. Pages
  // will be cached for 60000ms (1 minute).
  return fetchWebpage(`/Products/Product-${styleCode}`, 6e4).then(({ cached, result: jsdom, setCache }) => {
    if (cached) return jsdom
    
    // Extract the document from the JSDOM object and set it as a variable named "dom"
    const { window: { document: dom } } = jsdom
    
    // Parse product information from the webpage
    const productInfo = {
      // The product ID (a.k.a. "Style Code" in most cases). This is typically displayed below
      // the price listing.
      id: Number(dom.querySelector(`[itemprop="sku"]`).textContent),
      
      // The name of the product. Extracted from the main title on the product page.
      name: dom.querySelector(`[itemprop="name"]`).textContent.trim(),
      
      /*
        An object containing the current price of the product, as displayed on its product
        page. Ideally, this would show price history too, in the case of price reductions.
        This will require some refinement, as sometimes the MRRP is also displayed on the
        page under "Price History".
      */
      price: {
        current: Number(dom.querySelector(`[itemprop="price"]`).getAttribute("content"))
      },
      
      /*
        The currency the product page was displayed with. By default, this will always be
        in GBP (Pounds), but could potentially be displayed in EUR (Euro), as Shoe Zone
        also serves Ireland.
      */
      currency: dom.querySelector(`[itemprop="priceCurrency"]`).getAttribute("content").trim().toUpperCase(),
      
      /*
        This is the first product image displayed on the product page. Usually a 400x400
        photo with a plain white background.
      */
      thumbnail: dom.querySelector("#main-image-0").getAttribute("src"),
      
      // The first entry will usually be "Mens", "Womens", "Girls", "Boys" or "Bags & Accessories".
      // Subsequent categories declare what type of product is being displayed (e.g. "Sandals")
      categories: Array.from(dom.querySelectorAll("#bread-crumbs .breadcrumb"), crumb => crumb.textContent.trim()),
      
      // An Array of Objects containing information about the size range of this product. Also
      // includes current quantities of stock available to order (currently in the warehouse)
      sizeRange: Array.from(dom.querySelectorAll("#divSizeSelector li[data-id][data-qty]")).map(size => ({
        size: size.textContent.trim().toUpperCase(),
        stock: {
          warehouse: Number(size.getAttribute("data-qty")),
          // NOT IMPLEMENTED - See notes.
          // store: undefined
        },
        code: size.getAttribute("data-id").trim().substr(-3)
      })),
      
      /*
        An Array of Objects containing information about the offers currently applied to the
        product (e.g. "Buy One Get One Free"). This includes icons for the offers (if applicable),
        in addition to an abbreviated name for the offer (e.g. "BOGOF")
      */
      offers: Array.from(
        dom.querySelectorAll("#divProdRightDT .grid:first-child .grid__col:last-child .float-right a[href][title]"),
        offer => ({
          name: offer.getAttribute("title").trim(),
          image: offer.querySelector("img").getAttribute("src"),
          abbr: abbreviateOffer(offer.getAttribute("title"))
        })
      ).filter(({ name }) => !ignoredOffers.includes(name.toLowerCase())),
      
      // NOT IMPLEMENTED - See notes.
      // storeId: undefined
    }
    
    // store the resulting JSON data in the cache
    setCache(productInfo)
    
    return productInfo
  })
}

/*
  Export only the public methods from the module. There's no need to have access to some of
  the methods within this module from the outside (e.g. `fetchWebpage`).
*/
module.exports = {
  locateStore,
  checkStoreStock,
  getProductInfo
}