const {
  getRoute,
} = require("../services/googleRoutes.service");

const calculateRoute = async (req, res) => {
  try {
    const {
      origin,
      destination,
    } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: "Origin and destination are required",
      });
    }

    const result = await getRoute({
      originLat: origin.lat,
      originLng: origin.lng,

      destinationLat: destination.lat,
      destinationLng: destination.lng,
    });

    const route = result.routes?.[0];

    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
      });
    }

    return res.json({
      success: true,

      data: {
        distanceMeters: route.distanceMeters,

        duration: route.duration,

        encodedPolyline:
          route.polyline?.encodedPolyline,
      },
    });

  } catch (error) {
    console.error(
      "Google Routes Error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to calculate route",
    });
  }
};

module.exports = {
  calculateRoute,
};