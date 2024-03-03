let db = require("./../helpers/db_helpers");
const jwt = require("jsonwebtoken");

module.exports = {
  createJWT: (payload) => {
    return jwt.sign(payload, "123", {
      expiresIn: "1h",
    });
  },

  decode: (req, res, next) => {
    const token = req.headers.authorization.split(" ")[1];

    if (!token) return res.status(404).json({ error: "Invalid Token" });

    const decode = jwt.verify(token, "123");

    const { email } = decode;
    // write query get user information from email
    db.query(
      'SELECT `user_id`, `username`, `name`, `email`, `mobile`, `mobile_code`, `password`, `auth_token`, `status`, `created_date` FROM `user_detail` WHERE `email` = ? AND `status` = "1" ',
      [email],
      (err, result) => {
        if (result.length > 0) {
          res.json({
            status: "1",
            payload: result[0],
          });
        }
      }
    );
  },
};
