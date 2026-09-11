const express = require("express");

const {
  calculateRoute,
} = require("../controllers/route.controller");

const router = express.Router();

router.post(
  "/directions",
  calculateRoute
);

module.exports = router;