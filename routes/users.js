var express = require("express");
const { decode } = require("../helpers/jwt");
var router = express.Router();

router.get("/auth", decode);
/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

module.exports = router;
