const axios = require("axios");

const GOOGLE_ROUTES_API =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

const getRoute = async ({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
}) => {
  const response = await axios.post(
    GOOGLE_ROUTES_API,
    {
      origin: {
        location: {
          latLng: {
            latitude: originLat,
            longitude: originLng,
          },
        },
      },

      destination: {
        location: {
          latLng: {
            latitude: destinationLat,
            longitude: destinationLng,
          },
        },
      },

      travelMode: "DRIVE",

      routingPreference: "TRAFFIC_AWARE",

      computeAlternativeRoutes: false,

      languageCode: "en-US",

      units: "METRIC",
    },
    {
      headers: {
        "Content-Type": "application/json",

        "X-Goog-Api-Key":
          process.env.GOOGLE_ROUTES_API_KEY,

        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
    }
  );

  return response.data;
};

module.exports = {
  getRoute,
};