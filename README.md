# We Heart Shoes API
This is the public API for the We Heart Shoes demo app. This API handles
things such as fetching product information, locating stores, and retreiving
stock levels.

All endpoints only accept `GET` requests. There is no database linked to this
API, due to all data being externally pulled from Shoe Zone's own website (this
also explains slower response times when requesting product information).

Store locator responses are cached for around 8 hours. Stock and product endpoints
are not cached due to serving live information. In future, ideally the product
info endpoint would only return stock levels and cache all other information for
at least 8 hours.

Due to limitations in the Shoe Zone website/APIs, I cannot server quantities of stock
available in a given store. The only workaround for this is to query quantities until
the API returns false. Please avoid doing this. I am looking for a solution.

You may also experience slow response times on certain endpoints. This is due to not
having an external API to access, and instead having to download a copy of the webpage
and scrape the information required from it. The Shoe Zone website uses server-side
rendering (on an ASP server), and therefore do not require an API for things like
their product details pages.

The client is available on GitHub pages at the following URL:
[https://clockworksquirrel.github.io/we-heart-shoes-staff-pwa](https://clockworksquirrel.github.io/we-heart-shoes-staff-pwa)

The source code for both client and server are both available on GitHub. The client
application is a PWA built with React. The server, hosted on Glitch, uses Express,
Axios and JSDOM to communicate with Shoe Zone's website and APIs. Please see below
for a summary of publicly available endpoints.

## Endpoints
* [`/api/locate?lat={number}&lon={number}&city={string}&postcode={string}`](https://whs-endpoints.glitch.me/api/locate?city=gloucester)
    *Note*: Only one of these query string parameters are **required**, unless using
    `lat` or `lon`, in which case both of these are required in order to work as
    intended.
    
* [`/api/product/:styleCode`](https://whs-endpoints.glitch.me/api/product/15070)
* [`/api/stock/:storeId/:styleCode?quantity={number}`](https://whs-endpoints.glitch.me/api/stock/1649/15070040?quantity=3)
    *Note*: Quantity is optional. If unspecified, the API will assume you are only
    checking for a single pair (`quantity=1`).