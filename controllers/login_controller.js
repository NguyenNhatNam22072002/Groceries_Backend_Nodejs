var db = require("./../helpers/db_helpers");
var helper = require("./../helpers/helpers");
const jwtHelper = require("./../helpers/jwt");
// var multiparty = require(multiparty)
var imageSavePath = "./public/img/";
var image_base_url = helper.ImagePath();

var deliver_price = 2.0;

module.exports.controller = (app, io, socket_list) => {
  const msg_success = "successfully";
  const msg_fail = "fail";
  const msg_invalidUser = "invalid username and password";
  const msg_already_register = "this email already register ";
  const msg_added_favorite = "add favorite list successfully";
  const msg_removed_favorite = "removed favorite list successfully";
  const msg_invalid_item = "invalid product item";
  const msg_add_to_item = "item added into cart successfully ";
  const msg_remove_to_cart = "item remove form cart successfully";
  const msg_add_address = "address added successfully";
  const msg_update_address = "address updated successfully";
  const msg_remove_address = "address removed successfully";

  const msg_add_payment_method = "payment method added successfully";
  const msg_remove_payment_method = "payment method removed successfully";

  app.post("/api/app/login", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    const token = jwtHelper.createJWT({ email: reqObj.email });

    helper.CheckParameterValid(
      res,
      reqObj,
      ["email", "password", "dervice_token"],
      () => {
        var auth_token = helper.createRequestToken();
        db.query(
          "UPDATE `user_detail` SET `auth_token`= ?,`dervice_token`=?,`modify_date`= NOW() WHERE `email` = ? AND `password` = ? AND `status` = ?",
          [
            auth_token,
            reqObj.dervice_token,
            reqObj.email,
            reqObj.password,
            "1",
          ],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (result.affectedRows > 0) {
              db.query(
                'SELECT * FROM `user_detail` WHERE `email` = ? AND `password` = ? AND `status` = "1" ',
                [reqObj.email, reqObj.password],
                (err, result) => {
                  if (err) {
                    helper.ThrowHtmlError(err, res);
                    return;
                  }

                  if (result.length > 0) {
                    res.json({
                      status: "1",
                      payload: result[0],
                      message: msg_success,
                    });
                  } else {
                    res.json({ status: "0", message: msg_invalidUser });
                  }
                }
              );
            } else {
              res.json({ status: "0", message: msg_invalidUser });
            }
          }
        );
      }
    );
  });

  app.post("/api/app/sign_up", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    helper.CheckParameterValid(
      res,
      reqObj,
      ["username", "email", "password", "dervice_token"],
      () => {
        db.query(
          "SELECT `user_id`, `status` FROM `user_detail` WHERE `email` = ? ",
          [reqObj.email],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (result.length > 0) {
              res.json({
                status: "1",
                payload: result[0],
                message: msg_already_register,
              });
            } else {
              var auth_token = helper.createRequestToken();
              db.query(
                "INSERT INTO `user_detail`( `username`, `email`, `password`, `auth_token`, `dervice_token`, `created_date`, `modify_date`) VALUES (?,?,?, ?,?, NOW(), NOW())",
                [
                  reqObj.username,
                  reqObj.email,
                  reqObj.password,
                  auth_token,
                  reqObj.dervice_token,
                ],
                (err, result) => {
                  if (err) {
                    helper.ThrowHtmlError(err, res);
                    return;
                  }

                  if (result) {
                    db.query(
                      'SELECT `user_id`, `username`, `name`, `email`, `mobile`, `mobile_code`, `password`, `auth_token`, `status`, `created_date`  FROM `user_detail` WHERE `user_id` = ? AND `status` = "1" ',
                      [result.insertId],
                      (err, result) => {
                        if (err) {
                          helper.ThrowHtmlError(err, res);
                          return;
                        }

                        if (result.length > 0) {
                          res.json({
                            status: "1",
                            payload: result[0],
                            message: msg_success,
                          });
                        } else {
                          res.json({ status: "0", message: msg_invalidUser });
                        }
                      }
                    );
                  } else {
                    res.json({ status: "0", message: msg_fail });
                  }
                }
              );
            }
          }
        );
      }
    );
  });

  app.post("/api/app/get_zone_area", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    db.query(
      "SELECT `zone_id`, `name` FROM `zone_detail` WHERE `status`= ? ;" +
        "SELECT `ad`.`area_id`, `ad`.`zone_id` , `ad`.`name`, `zd`.`name` AS `zone_name`  FROM `area_detail` AS `ad` " +
        "INNER JOIN `zone_detail` AS `zd` ON `zd`.`zone_id` = `ad`.`zone_id` AND `zd`.`status` = '1' " +
        "WHERE `ad`.`status`= ?",
      ["1", "1"],
      (err, result) => {
        if (err) {
          helper.ThrowHtmlError(err, res);
          return;
        }

        result[0].forEach((zObj) => {
          zObj.area_list = result[1].filter((aObj) => {
            return aObj.zone_id == zObj.zone_id;
          });
        });

        res.json({ status: "1", payload: result[0], message: msg_success });
      }
    );
  });

  app.post("/api/app/home_exlusive_offer", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;
    var page = reqObj.page || 1; // Default to page 1 if not provided
    var itemsPerPage = reqObj.itemsPerPage || 5; // Default to 5 items per page if not provided

    checkAccessToken(
      req.headers,
      res,
      (uObj) => {
        var offset = (page - 1) * itemsPerPage;

        db.query(
          "SELECT `od`.`price` as `offer_price`, MIN(`od`.`start_date`) AS `min_start_date`, `od`.`end_date`, `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`, `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, (CASE WHEN `imd`.`image` != '' THEN CONCAT('" +
            image_base_url +
            "' ,'', `imd`.`image` ) ELSE '' END) AS `image`  , `cd`.`cat_name`,  `td`.`type_name`, MAX( CASE WHEN `fd`.`fav_id` IS NOT NULL THEN 1 ELSE 0 END ) AS `is_fav` FROM `offer_detail` AS `od` " +
            "INNER JOIN `product_detail` AS `pd` ON `pd`.`prod_id` = `od`.`prod_id` AND `pd`.`status` = ? " +
            "INNER JOIN `image_detail` AS `imd` ON `pd`.`prod_id` = `imd`.`prod_id` AND `imd`.`status` = 1 " +
            "INNER JOIN `category_detail` AS `cd` ON `cd`.`cat_id` = `pd`.`cat_id` AND `cd`.`status` = 1 " +
            "LEFT JOIN  `favorite_detail` AS `fd` ON  `pd`.`prod_id` = `fd`.`prod_id` AND `fd`.`user_id` = ? AND `fd`.`status`=  1 " +
            "INNER JOIN `type_detail` AS `td` ON `pd`.`type_id` = `td`.`type_id` AND `td`.`status` = 1 " +
            "WHERE `od`.`status` = ? AND `od`.`start_date` <= NOW() AND `od`.`end_date` >= NOW() GROUP BY `pd`.`prod_id`,`od`.`price`, `od`.`end_date`, `imd`.`image` " +
            "LIMIT ? OFFSET ?;",
          ["1", uObj.user_id, "1", itemsPerPage, offset],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            res.json({
              status: "1",
              payload: {
                offer_list: result,
              },
              message: msg_success,
            });
          }
        );
      },
      "1"
    );
  });

  app.post("/api/app/home_best_selling", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;
    var page = reqObj.page || 1; // Default to page 1 if not provided
    var itemsPerPage = reqObj.itemsPerPage || 5; // Default to 10 items per page if not provided

    checkAccessToken(
      req.headers,
      res,
      (uObj) => {
        var offset = (page - 1) * itemsPerPage;

        db.query(
          "SELECT `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`, `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, (CASE WHEN `imd`.`image` != '' THEN CONCAT('" +
            image_base_url +
            "' ,'', `imd`.`image` ) ELSE '' END) AS `image`, `cd`.`cat_name`,  `td`.`type_name`, MAX( CASE WHEN `fd`.`fav_id` IS NOT NULL THEN 1 ELSE 0 END ) AS `is_fav`, SUM(`pd`.`sales_quantity`) AS `sales_quantity` FROM  `product_detail` AS `pd` " +
            "LEFT JOIN  `favorite_detail` AS `fd` ON  `pd`.`prod_id` = `fd`.`prod_id` AND `fd`.`user_id` = ? AND `fd`.`status`=  1 " +
            "INNER JOIN `image_detail` AS `imd` ON `pd`.`prod_id` = `imd`.`prod_id` AND `imd`.`status` = 1 " +
            "INNER JOIN `category_detail` AS `cd` ON `cd`.`cat_id` = `pd`.`cat_id` AND `cd`.`status` = 1 " +
            "INNER JOIN `type_detail` AS `td` ON `pd`.`type_id` = `td`.`type_id` AND `td`.`status` = 1 " +
            "WHERE `pd`.`status` = ? " +
            "GROUP BY `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`, `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, `image`, `cd`.`cat_name`, `td`.`type_name` " +
            "ORDER BY `sales_quantity` DESC " + // Order by sales_quantity in descending order
            "LIMIT ? OFFSET ?;",
          [uObj.user_id, "1", itemsPerPage, offset],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }
            res.json({
              status: "1",
              payload: {
                best_sell_list: result,
              },
              message: msg_success,
            });
          }
        );
      },
      "1"
    );
  });

  app.post("/api/app/home_groceries", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;
    checkAccessToken(
      req.headers,
      res,
      (uObj) => {
        db.query(
          "SELECT `type_id`, `type_name`, (CASE WHEN `image` != '' THEN  CONCAT('" +
            image_base_url +
            "' ,'', `image` ) ELSE '' END) AS `image` , `color` FROM `type_detail` WHERE `status` = ?; ",
          ["1"],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            res.json({
              status: "1",
              payload: {
                type_list: result,
              },
              message: msg_success,
            });
          }
        );
      },
      "1"
    );
  });

  app.post("/api/app/home_all_products", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;
    var page = reqObj.page || 1; // Default to page 1 if not provided
    var itemsPerPage = 5;

    checkAccessToken(
      req.headers,
      res,
      (uObj) => {
        var offset = (page - 1) * itemsPerPage;

        db.query(
          "SELECT `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`, `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, (CASE WHEN `imd`.`image` != '' THEN CONCAT('" +
            image_base_url +
            "' ,'', `imd`.`image` ) ELSE '' END) AS `image`, `cd`.`cat_name`,  `td`.`type_name`, MAX( CASE WHEN `fd`.`fav_id` IS NOT NULL THEN 1 ELSE 0 END ) AS `is_fav` FROM  `product_detail` AS `pd` " +
            "LEFT JOIN  `favorite_detail` AS `fd` ON  `pd`.`prod_id` = `fd`.`prod_id` AND `fd`.`user_id` = ? AND `fd`.`status`=  1 " +
            "INNER JOIN `image_detail` AS `imd` ON `pd`.`prod_id` = `imd`.`prod_id` AND `imd`.`status` = 1 " +
            "INNER JOIN `category_detail` AS `cd` ON `cd`.`cat_id` = `pd`.`cat_id` AND `cd`.`status` = 1 " +
            "INNER JOIN `type_detail` AS `td` ON `pd`.`type_id` = `td`.`type_id` AND `td`.`status` = 1 " +
            "WHERE `pd`.`status` = ? " +
            "GROUP BY `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`, `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, `image`, `cd`.`cat_name`, `td`.`type_name` " +
            "ORDER BY `pd`.`prod_id` DESC " +
            "LIMIT ? OFFSET ?;",
          [uObj.user_id, "1", itemsPerPage, offset],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            res.json({
              status: "1",
              payload: {
                list: result,
              },
              message: msg_success,
            });
          }
        );
      },
      "1"
    );
  });

  app.post("/api/app/product_detail", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;
    checkAccessToken(
      req.headers,
      res,
      (uObj) => {
        helper.CheckParameterValid(res, reqObj, ["prod_id"], () => {
          getProductDetail(res, reqObj.prod_id, uObj.user_id);
        });
      },
      "1"
    );
  });

  app.post("/api/app/search_products", (req, res) => {
    try {
      helper.Dlog(req.body);
      var searchObj = req.body;

      // Extracting minprice and maxprice from request body
      var minprice = searchObj.minprice || 0; // default to 0 if not provided
      var maxprice = searchObj.maxprice || 100; // default to max integer if not provided

      // Assuming your search criteria are sent in the request body
      var searchQuery =
        "SELECT `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`, `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, " +
        "(CASE WHEN `imd`.`image` != '' THEN  CONCAT('" +
        image_base_url +
        "' ,'', `imd`.`image` ) ELSE '' END) AS `image`, `cd`.`cat_name`,  `td`.`type_name`, MAX( CASE WHEN `fd`.`fav_id` IS NOT NULL THEN 1 ELSE 0 END ) AS `is_fav` " +
        "FROM `product_detail` AS `pd` " +
        "INNER JOIN `image_detail` AS `imd` ON `pd`.`prod_id` = `imd`.`prod_id` AND `imd`.`status` = 1 " +
        "INNER JOIN `category_detail` AS `cd` ON `cd`.`cat_id` = `pd`.`cat_id` AND `cd`.`status` = 1 " +
        "LEFT JOIN  `favorite_detail` AS `fd` ON  `pd`.`prod_id` = `fd`.`prod_id` AND `fd`.`user_id` = ? " +
        "INNER JOIN `type_detail` AS `td` ON `pd`.`type_id` = `td`.`type_id` AND `td`.`status` = 1 " +
        "WHERE `pd`.`status` = '1' AND `pd`.`name` LIKE ? AND `pd`.`price` BETWEEN ? AND ? GROUP BY `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`, `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, `image`, `cd`.`cat_name`, `td`.`type_name`;";

      db.query(
        searchQuery,
        [
          "1",
          searchObj.keyword ? `%${searchObj.keyword}%` : "%%",
          minprice,
          maxprice,
        ],
        (err, result) => {
          if (err) {
            helper.ThrowHtmlError(err, res);
            return;
          }

          if (result.length > 0) {
            res.json({
              status: "1",
              payload: result,
            });
          } else {
            res.json({
              status: "0",
              message: "No products found matching the search criteria.",
            });
          }
        }
      );
    } catch (error) {
      helper.ThrowHtmlError(error, res);
    }
  });

  app.post("/api/app/filter_searched_products", (req, res) => {
    helper.Dlog(req.body);
    var filterObj = req.body;

    // Assuming your search results are sent in the request body
    var searchResults = filterObj.payload;

    // Add price range filter
    if (filterObj.min_price && filterObj.max_price) {
      searchResults = searchResults.filter(
        (product) =>
          product.price >= filterObj.min_price &&
          product.price <= filterObj.max_price
      );
    }

    // You can add more filters as needed

    if (searchResults.length > 0) {
      res.json({
        status: "1",
        payload: searchResults,
      });
    } else {
      res.json({
        status: "0",
        message: "No products found matching the filter criteria.",
      });
    }
  });

  app.post("/api/app/add_remove_favorite", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(
      req.headers,
      res,
      (userObj) => {
        helper.CheckParameterValid(res, reqObj, ["prod_id"], () => {
          db.query(
            "SELECT `fav_id`, `prod_id` FROM `favorite_detail` WHERE `prod_id` = ? AND `user_id` = ? AND `status` = '1' ",
            [reqObj.prod_id, userObj.user_id],
            (err, result) => {
              if (err) {
                helper.ThrowHtmlError(err, res);
                return;
              }

              if (result.length > 0) {
                // Already add Favorite List To Delete Fave
                db.query(
                  "DELETE FROM `favorite_detail` WHERE `prod_id` = ? AND `user_id` = ? ",
                  [reqObj.prod_id, userObj.user_id],
                  (err, result) => {
                    if (err) {
                      helper.ThrowHtmlError(err, res);
                      return;
                    } else {
                      res.json({
                        status: "1",
                        message: msg_removed_favorite,
                      });
                    }
                  }
                );
              } else {
                // Not Added  Favorite List TO Add
                db.query(
                  "INSERT INTO `favorite_detail`(`prod_id`, `user_id`) VALUES (?,?) ",
                  [reqObj.prod_id, userObj.user_id],
                  (err, result) => {
                    if (err) {
                      helper.ThrowHtmlError(err, res);
                      return;
                    }

                    if (result) {
                      res.json({
                        status: "1",
                        message: msg_added_favorite,
                      });
                    } else {
                      res.json({
                        status: "0",
                        message: msg_fail,
                      });
                    }
                  }
                );
              }
            }
          );
        });
      },
      "1"
    );
  });

  app.post("/api/app/favorite_list", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(
      req.headers,
      res,
      (userObj) => {
        db.query(
          "SELECT `fd`.`fav_id`, `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`,  `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, `pd`.`created_date`, `pd`.`modify_date`, `cd`.`cat_name`, IFNULL( `bd`.`brand_name`, '' ) AS `brand_name` , `td`.`type_name`, IFNULL(`od`.`price`, `pd`.`price` ) as `offer_price`, IFNULL(`od`.`start_date`,'') as `start_date`, IFNULL(`od`.`end_date`,'') as `end_date`, (CASE WHEN `od`.`offer_id` IS NOT NULL THEN 1 ELSE 0 END) AS `is_offer_active`, 1 AS `is_fav`, (CASE WHEN `imd`.`image` != '' THEN  CONCAT( '" +
            image_base_url +
            "' ,'', `imd`.`image` ) ELSE '' END) AS `image` FROM `favorite_detail` AS  `fd` " +
            "INNER JOIN  `product_detail` AS `pd` ON  `pd`.`prod_id` = `fd`.`prod_id` AND `pd`.`status` = 1 " +
            "INNER JOIN `category_detail` AS `cd` ON `pd`.`cat_id` = `cd`.`cat_id` " +
            "INNER JOIN `image_detail` AS `imd` ON `pd`.`prod_id` = `imd`.`prod_id` AND `imd`.`status` = 1 " +
            "LEFT JOIN `brand_detail` AS `bd` ON `pd`.`brand_id` = `bd`.`brand_id` " +
            "LEFT JOIN `offer_detail` AS `od` ON `pd`.`prod_id` = `od`.`prod_id` AND `od`.`status` = 1 AND `od`.`start_date` <= NOW() AND `od`.`end_date` >= NOW() " +
            "INNER JOIN `type_detail` AS `td` ON `pd`.`type_id` = `td`.`type_id` " +
            " WHERE `fd`.`user_id` = ? AND `fd`.`status` = '1' GROUP BY `fd`.`fav_id`, `pd`.`prod_id`, `od`.`price`,`od`.`start_date`, `od`.`end_date`,  `od`.`offer_id`, `imd`.`image`; ",
          [userObj.user_id],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            res.json({
              status: "1",
              payload: result,
              message: msg_success,
            });
          }
        );
      },
      "1"
    );
  });

  app.post("/api/app/explore_category_list", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(
      req.headers,
      res,
      (userObj) => {
        db.query(
          "SELECT `cat_id`, `cat_name`, (CASE WHEN `image` != '' THEN  CONCAT( '" +
            image_base_url +
            "' ,'', `image` ) ELSE '' END) AS `image` , `color` FROM `category_detail` WHERE `status` = 1 ",
          [],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            res.json({
              status: "1",
              payload: result,
              message: msg_success,
            });
          }
        );
      },
      "1"
    );
  });

  app.post("/api/app/explore_category_items_list", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(
      req.headers,
      res,
      (userObj) => {
        helper.CheckParameterValid(res, reqObj, ["cat_id"], () => {
          db.query(
            "SELECT `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`,  `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, `pd`.`created_date`, `pd`.`modify_date`, `cd`.`cat_name`, IFNULL( `bd`.`brand_name`, '' ) AS `brand_name` , `td`.`type_name`, IFNULL(MAX(`od`.`price`), `pd`.`price` ) as `offer_price`, IFNULL(MAX(`od`.`start_date`),'') as `start_date`, IFNULL(MAX(`od`.`end_date`),'') as `end_date`, (CASE WHEN `od`.`offer_id` IS NOT NULL THEN 1 ELSE 0 END) AS `is_offer_active`, ( CASE WHEN `fd`.`fav_id` IS NOT NULL THEN 1 ELSE 0 END ) AS `is_fav`, (CASE WHEN `imd`.`image` != '' THEN  CONCAT( '" +
              image_base_url +
              "' ,'', `imd`.`image` ) ELSE '' END) AS `image` FROM  `product_detail` AS `pd` " +
              "LEFT JOIN `favorite_detail` AS  `fd`  ON  `pd`.`prod_id` = `fd`.`prod_id` AND `fd`.`status` = 1 " +
              "INNER JOIN `category_detail` AS `cd` ON `pd`.`cat_id` = `cd`.`cat_id` AND `pd`.`status` = 1 " +
              "INNER JOIN `image_detail` AS `imd` ON `pd`.`prod_id` = `imd`.`prod_id` AND `imd`.`status` = 1 " +
              "LEFT JOIN `brand_detail` AS `bd` ON `pd`.`brand_id` = `bd`.`brand_id` " +
              "LEFT JOIN `offer_detail` AS `od` ON `pd`.`prod_id` = `od`.`prod_id` AND `od`.`status` = 1 AND `od`.`start_date` <= NOW() AND `od`.`end_date` >= NOW() " +
              "INNER JOIN `type_detail` AS `td` ON `pd`.`type_id` = `td`.`type_id` " +
              " WHERE `cd`.`cat_id` = ? AND `cd`.`status` = '1' GROUP BY `pd`.`prod_id`, `od`.`start_date`, `od`.`offer_id`, `fd`.`fav_id`, `imd`.`image` ",
            [reqObj.cat_id],
            (err, result) => {
              if (err) {
                helper.ThrowHtmlError(err, res);
                return;
              }

              res.json({
                status: "1",
                payload: result,
                message: msg_success,
              });
            }
          );
        });
      },
      "1"
    );
  });

  app.post("/api/app/add_to_cart", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(res, reqObj, ["prod_id", "qty"], () => {
        db.query(
          "Select `prod_id` FROM `product_detail` WHERE  `prod_id` = ? AND `status` = 1 ",
          [reqObj.prod_id],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (result.length > 0) {
              //Valid Item

              db.query(
                "INSERT INTO `cart_detail`(`user_id`, `prod_id`, `qty`) VALUES (?,?,?) ",
                [userObj.user_id, reqObj.prod_id, reqObj.qty],
                (err, result) => {
                  if (err) {
                    helper.ThrowHtmlError(err, res);
                    return;
                  }

                  if (result) {
                    res.json({
                      status: "1",
                      message: msg_add_to_item,
                    });
                  } else {
                    res.json({
                      status: "0",
                      message: msg_fail,
                    });
                  }
                }
              );
            } else {
              //Invalid Item
              res.json({
                status: "0",
                message: msg_invalid_item,
              });
            }
          }
        );
      });
    });
  });

  app.post("/api/app/update_cart", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(
        res,
        reqObj,
        ["cart_id", "prod_id", "new_qty"],
        () => {
          // Valid
          var status = "1";

          if (reqObj.new_qty == "0") {
            status = "2";
          }
          db.query(
            "UPDATE `cart_detail` SET `qty`= ? , `status`= ?, `modify_date`= NOW() WHERE `cart_id` = ? AND `prod_id` = ? AND `user_id` = ? AND `status` = ? ",
            [
              reqObj.new_qty,
              status,
              reqObj.cart_id,
              reqObj.prod_id,
              userObj.user_id,
              "1",
            ],
            (err, result) => {
              if (err) {
                helper.ThrowHtmlError(err, res);
                return;
              }

              if (result.affectedRows > 0) {
                res.json({
                  status: "1",
                  message: msg_success,
                });
              } else {
                res.json({
                  status: "0",
                  message: msg_fail,
                });
              }
            }
          );
        }
      );
    });
  });

  app.post("/api/app/remove_cart", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(res, reqObj, ["cart_id", "prod_id"], () => {
        db.query(
          "UPDATE `cart_detail` SET `status`= '2', `modify_date`= NOW() WHERE `cart_id` = ? AND `prod_id` = ? AND  `user_id` = ? AND  `status` = ? ",
          [reqObj.cart_id, reqObj.prod_id, userObj.user_id, "1"],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (result.affectedRows > 0) {
              res.json({
                status: "1",
                message: msg_remove_to_cart,
              });
            } else {
              res.json({
                status: "0",
                message: msg_fail,
              });
            }
          }
        );
      });
    });
  });

  app.post("/api/app/cart_list", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      getUserCart(res, userObj.user_id, (result, total) => {
        var promo_code_id = reqObj.promo_code_id;
        if (promo_code_id == undefined || promo_code_id == null) {
          promo_code_id = "";
        }

        var deliver_type = reqObj.deliver_type;
        if (deliver_type == undefined || deliver_type == null) {
          deliver_type = "1";
        }

        db.query(
          "SELECT `promo_code_id`, `min_order_amount`, `max_discount_amount`, `offer_price` FROM `promo_code_detail` WHERE  `start_date` <= NOW() AND `end_date` >= NOW()  AND `status` = 1  AND `promo_code_id` = ? ;",
          [reqObj.promo_code_id],
          (err, pResult) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            var deliver_price_amount = 0.0;

            if (deliver_type == "1") {
              deliver_price_amount = deliver_price;
            } else {
              deliver_price_amount = 0.0;
            }

            var final_total = total;
            var discountAmount = 0.0;

            if (promo_code_id != "") {
              if (pResult.length > 0) {
                //Promo Code Apply & Valid

                if (final_total > pResult[0].min_order_amount) {
                  if (pResult[0].type == 2) {
                    // Fixed Discount
                    discountAmount = pResult[0].offer_price;
                  } else {
                    //% Per

                    var disVal = final_total * (pResult[0].offer_price / 100);

                    helper.Dlog("disVal: " + disVal);

                    if (pResult[0].max_discount_amount <= disVal) {
                      //Max discount is more then disVal
                      discountAmount = pResult[0].max_discount_amount;
                    } else {
                      //Max discount is Small then disVal
                      discountAmount = disVal;
                    }
                  }
                } else {
                  res.json({
                    status: "0",
                    payload: result,
                    total: total.toFixed(2),
                    deliver_price_amount: deliver_price_amount.toFixed(2),
                    discount_amount: 0,
                    user_pay_price: (
                      final_total + deliver_price_amount
                    ).toFixed(2),
                    message:
                      "Promo Code not apply need min order: $" +
                      pResult[0].min_order_amount,
                  });
                  return;
                }
              } else {
                //Promo Code Apply not Valid
                res.json({
                  status: "0",
                  payload: result,
                  total: total.toFixed(2),
                  deliver_price_amount: deliver_price_amount.toFixed(2),
                  discount_amount: 0,
                  user_pay_price: (final_total + deliver_price_amount).toFixed(
                    2
                  ),
                  message: "Invalid Promo Code",
                });
                return;
              }
            }

            var user_pay_price =
              final_total +
              deliver_price_amount +
              -discountAmount -
              reqObj.coin;

            // Trừ 1 từ final total nếu người dùng đồng ý

            res.json({
              status: "1",
              payload: result,
              total: final_total.toFixed(2),
              deliver_price_amount: deliver_price_amount.toFixed(2),
              discount_amount: discountAmount.toFixed(2),
              user_pay_price: user_pay_price.toFixed(2),
              message: msg_success,
            });
          }
        );
      });
    });
  });

  app.post("/api/app/add_delivery_address", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;
    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(
        res,
        reqObj,
        [
          "name",
          "type_name",
          "phone",
          "address",
          "city",
          "state",
          "postal_code",
        ],
        () => {
          db.query(
            "INSERT INTO `address_detail`(`user_id`, `name`, `phone`, `address`, `city`, `state`, `type_name`, `postal_code`) VALUES (?,?,?, ?,?,?, ?,?) ",
            [
              userObj.user_id,
              reqObj.name,
              reqObj.phone,
              reqObj.address,
              reqObj.city,
              reqObj.state,
              reqObj.type_name,
              reqObj.postal_code,
            ],
            (err, result) => {
              if (err) {
                helper.ThrowHtmlError(err, res);
                return;
              }

              if (result) {
                res.json({
                  status: "1",
                  message: msg_add_address,
                });
              } else {
                res.json({
                  status: "0",
                  message: msg_fail,
                });
              }
            }
          );
        }
      );
    });
  });

  app.post("/api/app/update_delivery_address", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;
    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(
        res,
        reqObj,
        [
          "address_id",
          "name",
          "type_name",
          "phone",
          "address",
          "city",
          "state",
          "postal_code",
        ],
        () => {
          db.query(
            "UPDATE `address_detail` SET `name`=? ,`phone`=? ,`address`=? ,`city`=? ,`state`=? ,`type_name`=? ,`postal_code`=?, `modify_date`= NOW() WHERE `user_id` = ? AND `address_id` = ? AND `status` = 1 ",
            [
              reqObj.name,
              reqObj.phone,
              reqObj.address,
              reqObj.city,
              reqObj.state,
              reqObj.type_name,
              reqObj.postal_code,
              userObj.user_id,
              reqObj.address_id,
            ],
            (err, result) => {
              if (err) {
                helper.ThrowHtmlError(err, res);
                return;
              }

              if (result.affectedRows > 0) {
                res.json({
                  status: "1",
                  message: msg_update_address,
                });
              } else {
                res.json({
                  status: "0",
                  message: msg_fail,
                });
              }
            }
          );
        }
      );
    });
  });

  app.post("/api/app/delete_delivery_address", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;
    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(res, reqObj, ["address_id"], () => {
        db.query(
          "UPDATE `address_detail` SET  `status`=2, `modify_date`= NOW() WHERE `user_id` = ? AND `address_id` = ? AND `status` = 1 ",
          [userObj.user_id, reqObj.address_id],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (result.affectedRows > 0) {
              res.json({
                status: "1",
                message: msg_remove_address,
              });
            } else {
              res.json({
                status: "0",
                message: msg_fail,
              });
            }
          }
        );
      });
    });
  });

  app.post("/api/app/mark_default_delivery_address", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;
    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(res, reqObj, ["address_id"], () => {
        db.query(
          "UPDATE `address_detail` SET `is_default` = (CASE WHEN `address_id` = ? THEN 1 ELSE 0 END) , `modify_date`= NOW() WHERE `user_id` = ? AND `status` = 1 ",
          [reqObj.address_id, userObj.user_id],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (result.affectedRows > 0) {
              res.json({
                status: "1",
                message: msg_success,
              });
            } else {
              res.json({
                status: "0",
                message: msg_fail,
              });
            }
          }
        );
      });
    });
  });

  app.post("/api/app/delivery_address", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;
    checkAccessToken(req.headers, res, (userObj) => {
      db.query(
        "SELECT `address_id`, `name`, `phone`, `address`, `city`, `state`, `type_name`, `postal_code`, `is_default` FROM `address_detail` WHERE `user_id` = ? AND `status` = 1 ",
        [userObj.user_id],
        (err, result) => {
          if (err) {
            helper.ThrowHtmlError(err, res);
            return;
          }

          res.json({
            status: "1",
            payload: result,
            message: msg_success,
          });
        }
      );
    });
  });

  app.post("/api/app/promo_code_list", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(
      req.headers,
      res,
      (userObj) => {
        db.query(
          "SELECT `promo_code_id`, `code`, `title`, `description`, `type`, `min_order_amount`, `max_discount_amount`, `offer_price`, `start_date`, `end_date`, `created_date`, `modify_date` FROM `promo_code_detail` WHERE `start_date` <= NOW() AND `end_date` >= NOW()  AND `status` = 1 ORDER BY `start_date` ",
          [],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            res.json({
              status: "1",
              payload: result,
              message: msg_success,
            });
          }
        );
      },
      "1"
    );
  });

  app.post("/api/app/add_payment_method", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(
        res,
        reqObj,
        ["name", "card_number", "card_month", "card_year"],
        () => {
          db.query(
            "INSERT INTO `payment_method_detail` (`user_id`, `name`, `card_number`, `card_month`, `card_year`) VALUES (?,?,?, ?,? )",
            [
              userObj.user_id,
              reqObj.name,
              reqObj.card_number,
              reqObj.card_month,
              reqObj.card_year,
            ],
            (err, result) => {
              if (err) {
                helper.ThrowHtmlError(err, res);
                return;
              }

              if (result) {
                res.json({
                  status: "1",
                  message: msg_add_payment_method,
                });
              } else {
                res.json({
                  status: "1",
                  message: msg_fail,
                });
              }
            }
          );
        }
      );
    });
  });

  app.post("/api/app/remove_payment_method", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(res, reqObj, ["pay_id"], () => {
        db.query(
          "UPDATE `payment_method_detail` SET `status`= 2 WHERE `pay_id` = ? AND `user_id` = ? AND `status` = 1 ",
          [reqObj.pay_id, userObj.user_id],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (result.affectedRows > 0) {
              res.json({
                status: "1",
                message: msg_remove_payment_method,
              });
            } else {
              res.json({
                status: "1",
                message: msg_fail,
              });
            }
          }
        );
      });
    });
  });

  app.post("/api/app/payment_method", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      db.query(
        "SELECT `pay_id`, `name`, RIGHT( `card_number`, 4) AS `card_number` , `card_month`, `card_year` FROM `payment_method_detail` WHERE  `user_id` = ? AND `status` = 1 ",
        [userObj.user_id],
        (err, result) => {
          if (err) {
            helper.ThrowHtmlError(err, res);
            return;
          }

          res.json({
            status: "1",
            payload: result,
            message: msg_success,
          });
        }
      );
    });
  });

  app.post("/api/app/order_place", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(
        res,
        reqObj,
        [
          "address_id",
          "payment_type",
          "deliver_type",
          "pay_id",
          "promo_code_id",
        ],
        () => {
          getUserCart(res, userObj.user_id, (result, total) => {
            if (result.length > 0) {
              db.query(
                "SELECT `pay_id`, `user_id`, `card_month`, `card_year` FROM `payment_method_detail` WHERE `pay_id` = ? AND `status` = 1; " +
                  "SELECT `promo_code_id`, `min_order_amount`, `max_discount_amount`, `offer_price` FROM `promo_code_detail` WHERE  `start_date` <= NOW() AND `end_date` >= NOW()  AND `status` = 1  AND `promo_code_id` = ? ; " +
                  "SELECT `address_id`, `user_id` FROM `address_detail` WHERE `address_id` = ? AND `user_id` = ? AND `status` = 1 ;",
                [
                  reqObj.pay_id,
                  reqObj.promo_code_id,
                  reqObj.address_id,
                  userObj.user_id,
                ],
                (err, pResult) => {
                  if (err) {
                    helper.ThrowHtmlError(err, res);
                    return;
                  }

                  var deliver_price_amount = 0.0;

                  if (reqObj.deliver_type == "1" && pResult[2].length == 0) {
                    res.json({
                      status: "0",
                      message: "Please select address",
                    });
                    return;
                  }

                  if (reqObj.deliver_type == "1") {
                    deliver_price_amount = deliver_price;
                  } else {
                    deliver_price_amount = 0.0;
                  }

                  var final_total = total;
                  var discountAmount = 0.0;

                  if (reqObj.promo_code_id != "") {
                    if (pResult[1].length > 0) {
                      //Promo Code Apply & Valid

                      if (final_total > pResult[1][0].min_order_amount) {
                        if (pResult[1][0].type == 2) {
                          // Fixed Discount
                          discountAmount = pResult[1][0].offer_price;
                        } else {
                          //% Per

                          var disVal =
                            final_total * (pResult[1][0].offer_price / 100);

                          helper.Dlog("disVal: " + disVal);

                          if (pResult[1][0].max_discount_amount <= disVal) {
                            //Max discount is more then disVal
                            discountAmount = pResult[1][0].max_discount_amount;
                          } else {
                            //Max discount is Small then disVal
                            discountAmount = disVal;
                          }
                        }
                      } else {
                        res.json({
                          status: "0",
                          message:
                            "Promo Code not apply need min order: $" +
                            pResult[1][0].min_order_amount,
                        });
                        return;
                      }
                    } else {
                      //Promo Code Apply not Valid
                      res.json({
                        status: "0",
                        message: "Sorry, Promo Code not apply",
                      });
                      return;
                    }
                  }

                  if (
                    reqObj.payment_type == "1" ||
                    (reqObj.payment_type == "2" && pResult[0].length > 0)
                  ) {
                    var cartId = result.map((cObj) => {
                      return cObj.cart_id;
                    });

                    var user_pay_price =
                      final_total + deliver_price_amount + -discountAmount;
                    helper.Dlog("user_pay_price: " + user_pay_price);
                    helper.Dlog(cartId.toString());

                    db.query(
                      "INSERT INTO `order_detail`(`cart_id`, `user_id`, `address_id`, `total_price`, `user_pay_price`, `discount_price`, `deliver_price`, `promo_code_id`, `deliver_type`, `payment_type`) VALUES (?,?,?, ?,?,?, ?,?,?, ? )",
                      [
                        cartId.toString(),
                        userObj.user_id,
                        reqObj.address_id,
                        total,
                        user_pay_price,
                        discountAmount,
                        deliver_price_amount,
                        reqObj.promo_code_id,
                        reqObj.deliver_type,
                        reqObj.payment_type,
                      ],
                      (err, result) => {
                        if (err) {
                          helper.ThrowHtmlError(err, res);
                          return;
                        }

                        if (result) {
                          if (reqObj.payment_type == "1") {
                            db.query(
                              "INSERT INTO `notification_detail`( `ref_id`, `user_id`, `title`, `message`, `notification_type`) VALUES (?,?,?, ?,?)",
                              [
                                result.insertId,
                                userObj.user_id,
                                "Order Placed",
                                "your order #" + result.insertId + " placed.",
                                "2",
                              ],
                              (err, iResult) => {
                                if (err) {
                                  helper.ThrowHtmlError(err);
                                  return;
                                }

                                if (iResult) {
                                  helper.Dlog("Notification Added Done");
                                } else {
                                  helper.Dlog("Notification Fail");
                                }
                              }
                            );
                          }

                          db.query(
                            "UPDATE `cart_detail` SET `status`= 2 ,`modify_date`= NOW() WHERE `user_id` = ? AND `status`= 1 ",
                            [userObj.user_id],
                            (err, cResult) => {
                              if (err) {
                                helper.ThrowHtmlError(err);
                                return;
                              }

                              if (cResult.affectedRows > 0) {
                                helper.Dlog("user card clear done");
                              } else {
                                helper.Dlog("user card clear fail");
                              }
                            }
                          );

                          res.json({
                            status: "1",
                            payload: {
                              order_id: result.insertId,
                              user_pay_price: user_pay_price,
                              deliver_price: discountAmount,
                              discount_price: deliver_price_amount,
                              total_price: total,
                            },
                            message: "your order place successfully",
                          });
                        } else {
                          res.json({
                            status: "0",
                            message: msg_fail,
                          });
                        }
                      }
                    );
                  } else {
                    res.json({
                      status: "0",
                      message: msg_fail,
                    });
                  }
                }
              );
            } else {
              res.json({
                status: "0",
                message: "cart is empty",
              });
            }
          });
        }
      );
    });
  });

  app.post("/api/app/order_payment_transaction", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(
        res,
        reqObj,
        [
          "order_id",
          "payment_transaction_id",
          "payment_status",
          "transaction_payload",
        ],
        () => {
          db.query(
            "INSERT INTO `order_payment_detail`( `order_id`, `transaction_payload`, `payment_transaction_id`, `status`) VALUES ( ?,?,?, ? )",
            [
              reqObj.order_id,
              reqObj.transaction_payload,
              reqObj.payment_transaction_id,
              reqObj.payment_status,
            ],
            (err, result) => {
              if (err) {
                helper.ThrowHtmlError(err, res);
                return;
              }

              if (result) {
                var message =
                  reqObj.payment_status == "2" ? "successfully" : "fail";

                db.query(
                  "INSERT INTO `notification_detail`( `ref_id`, `user_id`, `title`, `message`, `notification_type`) VALUES (?,?,?, ?,?)",
                  [
                    reqObj.order_id,
                    userObj.user_id,
                    "Order payment " + message,
                    "your order #" +
                      reqObj.order_id +
                      " payment " +
                      message +
                      ".",
                    "2",
                  ],
                  (err, iResult) => {
                    if (err) {
                      helper.ThrowHtmlError(err);
                      return;
                    }

                    if (iResult) {
                      helper.Dlog("Notification Added Done");
                    } else {
                      helper.Dlog("Notification Fail");
                    }
                  }
                );

                db.query(
                  "UPDATE `order_detail` SET `payment_status`=?,`modify_date`= NOW() WHERE `order_id` = ? AND `user_id` = ? AND `status` = 1",
                  [
                    reqObj.payment_status == "1" ? "2" : "3",
                    reqObj.order_id,
                    userObj.user_id,
                  ],
                  (err, uResult) => {
                    if (err) {
                      helper.ThrowHtmlError(err);
                      return;
                    }

                    if (uResult.affectedRows > 0) {
                      helper.Dlog("order payment status update done");
                    } else {
                      helper.Dlog("order payment status update fail");
                    }
                  }
                );
                res.json({
                  status: "1",
                  message: "your order place successfully",
                });
              } else {
                res.json({
                  status: "0",
                  message: msg_fail,
                });
              }
            }
          );
        }
      );
    });
  });

  app.post("/api/app/my_order", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      db.query(
        "SELECT `od`.`order_id`, `od`.`cart_id`, `od`.`total_price`, `od`.`user_pay_price`, `od`.`discount_price`, `od`.`deliver_price`, `od`.`deliver_type`, `od`.`payment_type`, `od`.`payment_status`, `od`.`order_status`, `od`.`status`, `od`.`created_date`, GROUP_CONCAT(DISTINCT `pd`.`name` SEPARATOR ',') AS `names`, GROUP_CONCAT(DISTINCT (CASE WHEN `imd`.`image` != '' THEN  CONCAT( '" +
          image_base_url +
          "' ,'', `imd`.`image` ) ELSE '' END) SEPARATOR ',') AS `images`, `ad`.`name` as `user_name`, `ad`.`phone`, `ad`.`address`, `ad`.`city`, `ad`.`state`, `ad`.`postal_code`   FROM `order_detail` AS `od` " +
          "INNER JOIN `cart_detail` AS `cd` ON FIND_IN_SET(`cd`.`cart_id`, `od`.`cart_id`) > 0  " +
          "INNER JOIN `product_detail` AS `pd` ON  `cd`.`prod_id` = `pd`.`prod_id` " +
          "INNER JOIN `address_detail` AS `ad` ON  `od`.`address_id` = `ad`.`address_id` " +
          "INNER JOIN `image_detail` AS `imd` ON  `imd`.`prod_id` = `pd`.`prod_id` " +
          "WHERE `od`.`user_id` = ? GROUP BY `od`.`order_id` ORDER BY `od`.`modify_date` DESC", // Sắp xếp theo trường modify_date
        [userObj.user_id],
        (err, result) => {
          if (err) {
            helper.ThrowHtmlError(err, res);
            return;
          }

          res.json({
            status: "1",
            payload: result,
            message: msg_success,
          });
        }
      );
    });
  });

  app.post("/api/app/my_order_detail", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(res, reqObj, ["order_id"], () => {
        db.query(
          "SELECT `od`.`order_id`, `od`.`cart_id`, `od`.`total_price`, `od`.`user_pay_price`, `od`.`discount_price`, `od`.`deliver_price`, `od`.`deliver_type`, `od`.`payment_type`, `od`.`payment_status`, `od`.`order_status`, `od`.`status`, `od`.`created_date` FROM `order_detail` AS `od` " +
            "WHERE `od`.`user_id` = ? AND `od`.`order_id` = ? ;" +
            `SELECT
                    uod.order_id,
                    ucd.cart_id,
                    ucd.user_id,
                    ucd.prod_id,
                    ucd.qty,
                    pd.cat_id,
                    pd.brand_id,
                    pd.type_id,
                    pd.name,
                    pd.detail,
                    pd.unit_name,
                    pd.unit_value,
                    pd.nutrition_weight,
                    pd.price,
                    pd.created_date,
                    pd.modify_date,
                    cd.cat_name,
                    (CASE WHEN fd.fav_id IS NOT NULL THEN 1 ELSE 0 END) AS is_fav,
                    IFNULL(bd.brand_name, '') AS brand_name,
                    td.type_name,
                    IFNULL(od.price, pd.price) AS offer_price,
                    IFNULL(od.start_date, '') AS start_date,
                    IFNULL(od.end_date, '') AS end_date,
                    (CASE WHEN od.offer_id IS NOT NULL THEN 1 ELSE 0 END) AS is_offer_active,
                    (CASE WHEN imd.image != '' THEN CONCAT('${image_base_url}', '', imd.image) ELSE '' END) AS image,
                    (CASE WHEN od.price IS NULL THEN pd.price ELSE od.price END) AS item_price,
                    ((CASE WHEN od.price IS NULL THEN pd.price ELSE od.price END) * ucd.qty) AS total_price
                FROM
                    order_detail AS uod
                    INNER JOIN cart_detail AS ucd ON FIND_IN_SET(ucd.cart_id, uod.cart_id) > 0
                    INNER JOIN product_detail AS pd ON pd.prod_id = ucd.prod_id AND pd.status = 1
                    INNER JOIN category_detail AS cd ON pd.cat_id = cd.cat_id
                    LEFT JOIN favorite_detail AS fd ON pd.prod_id = fd.prod_id AND fd.user_id = ? AND fd.status = 1
                    LEFT JOIN brand_detail AS bd ON pd.brand_id = bd.brand_id
                    LEFT JOIN offer_detail AS od ON pd.prod_id = od.prod_id AND od.status = 1 AND od.start_date <= NOW() AND od.end_date >= NOW()
                    INNER JOIN image_detail AS imd ON pd.prod_id = imd.prod_id AND imd.status = 1
                    INNER JOIN type_detail AS td ON pd.type_id = td.type_id
                WHERE
                    uod.order_id = ?
                    AND ucd.user_id = ?
                GROUP BY
                    ucd.cart_id, pd.prod_id, fd.fav_id, od.price, od.start_date, od.end_date, od.offer_id, imd.image
                LIMIT 0, 1000`,
          [
            userObj.user_id,
            reqObj.order_id,
            userObj.user_id,
            reqObj.order_id,
            userObj.user_id,
          ],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (result[0].length > 0) {
              result[0][0].cart_list = result[1];

              res.json({
                status: "1",
                payload: result[0][0],
                message: msg_success,
              });
            } else {
              res.json({
                status: "0",
                message: "invalid order",
              });
            }
          }
        );
      });
    });
  });

  app.post("/api/app/product_reviews", (req, res) => {
    const { product_id } = req.body;

    if (!product_id) {
      res.json({
        status: "0",
        message: "Product ID is required",
      });
      return;
    }

    db.query(
      "SELECT * FROM review_detail WHERE product_id = ?",
      [product_id],
      (err, result) => {
        if (err) {
          helper.ThrowHtmlError(err, res);
          return;
        }

        res.json({
          status: "1",
          payload: result,
          message: "Reviews retrieved successfully",
        });
      }
    );
  });

  app.post("/api/app/user_info", (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
      res.json({
        status: "0",
        message: "User ID is required",
      });
      return;
    }

    db.query(
      "SELECT * FROM user_detail WHERE user_id = ?",
      [user_id],
      (err, result) => {
        if (err) {
          helper.ThrowHtmlError(err, res);
          return;
        }

        if (result.length === 0) {
          res.json({
            status: "0",
            message: "User not found",
          });
          return;
        }

        const userInfo = result[0]; // Lấy thông tin người dùng từ kết quả truy vấn

        res.json({
          status: "1",
          payload: userInfo,
          message: "User information retrieved successfully",
        });
      }
    );
  });

  app.post("/api/app/add_product_review", (req, res) => {
    helper.Dlog(req.body);
    const { user_id, product_id, comment, rating, user_name } = req.body;

    db.query(
      "INSERT INTO review_detail (user_id, product_id, comment, rating, created_at, user_name) VALUES (?, ?, ?, ?, NOW(), ?)",
      [user_id, product_id, comment, rating, user_name],
      (err, result) => {
        if (err) {
          helper.ThrowHtmlError(err, res);
          return;
        }

        if (result) {
          // Add notification for admin
          const notification =
            "A new review has been added for product " +
            product_id +
            ": " +
            comment;
          db.query(
            "INSERT INTO notification_review (product_id, message, created_at) VALUES (?, ?, NOW())",
            [product_id, notification],
            (notificationErr, notificationResult) => {
              if (notificationErr) {
                console.error(
                  "Failed to add notification for admin:",
                  notificationErr
                );
                // Do something if notification addition fails
              }
              // Return success response for adding review
              res.json({
                status: "1",
                message: "Review added successfully",
              });
            }
          );
        } else {
          res.json({
            status: "0",
            message: "Failed to add review",
          });
        }
      }
    );
  });

  app.post("/api/app/notification_list", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(
      req.headers,
      res,
      (userObj) => {
        db.query(
          "SELECT `notification_id`, `ref_id`, `title`, `message`, `notification_type`, `is_read`, `created_date` FROM `notification_detail` WHERE `user_id` = ? AND `status` = 1",
          [userObj.user_id],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            res.json({
              status: "1",
              payload: result,
              message: msg_success,
            });
          }
        );
      },
      "1"
    );
  });

  app.post("/api/app/notification_read_all", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(
      req.headers,
      res,
      (userObj) => {
        db.query(
          "UPDATE `notification_detail` SET `is_read` = '2', `modify_date` = NOW() WHERE `user_id` = ? AND `status` = 1",
          [userObj.user_id],
          (err, result) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (result.affectedRows > 0) {
              res.json({
                status: "1",
                message: msg_success,
              });
            } else {
              res.json({
                status: "0",
                message: msg_fail,
              });
            }
          }
        );
      },
      "1"
    );
  });

  app.post("/api/app/update_profile", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(req.headers, res, (userObj) => {
      helper.CheckParameterValid(
        res,
        reqObj,
        ["username", "name", "mobile", "mobile_code"],
        () => {
          db.query(
            "UPDATE `user_detail` SET `username`=?,`name`=?,`mobile`=?,`mobile_code`=?,`modify_date`=NOW() WHERE `user_id` = ? AND `status` = 1",
            [
              reqObj.username,
              reqObj.name,
              reqObj.mobile,
              reqObj.mobile_code,
              userObj.user_id,
            ],
            (err, result) => {
              if (err) {
                helper.ThrowHtmlError(err, res);
                return;
              }

              if (result.affectedRows > 0) {
                db.query(
                  'SELECT `user_id`, `username`, `name`, `email`, `mobile`, `mobile_code`, `password`, `auth_token`, `status`, `created_date` FROM `user_detail` WHERE `user_id` = ? AND `status` = "1" ',
                  [userObj.user_id],
                  (err, result) => {
                    if (err) {
                      helper.ThrowHtmlError(err, res);
                      return;
                    }

                    if (result.length > 0) {
                      res.json({
                        status: "1",
                        payload: result[0],
                        message: msg_success,
                      });
                    } else {
                      res.json({ status: "0", message: msg_invalidUser });
                    }
                  }
                );
              } else {
                res.json({
                  status: "0",
                  message: msg_fail,
                });
              }
            }
          );
        }
      );
    });
  });

  app.post("/api/app/change_password", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    checkAccessToken(
      req.headers,
      res,
      (userObj) => {
        helper.CheckParameterValid(
          res,
          reqObj,
          ["current_password", "new_password"],
          () => {
            db.query(
              "UPDATE `user_detail` SET `password`=?, `modify_date`=NOW() WHERE `user_id` = ? AND `password` = ?",
              [reqObj.new_password, userObj.user_id, reqObj.current_password],
              (err, result) => {
                if (err) {
                  helper.ThrowHtmlError(err, res);
                  return;
                }

                if (result.affectedRows > 0) {
                  res.json({ status: "1", message: msg_success });
                } else {
                  res.json({
                    status: "0",
                    message: msg_fail,
                  });
                }
              }
            );
          }
        );
      },
      "1"
    );
  });

  app.post("/api/app/forgot_password_request", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    helper.CheckParameterValid(res, reqObj, ["email"], () => {
      db.query(
        "SELECT `user_id` FROM `user_detail` WHERE `email` = ? ",
        [reqObj.email],
        (err, result) => {
          if (err) {
            helper.ThrowHtmlError(err, res);
            return;
          }

          if (result.length > 0) {
            var reset_code = helper.createNumber();
            db.query(
              "UPDATE `user_detail` SET `reset_code` = ? WHERE `user_id` = ? ",
              [reset_code, result[0].user_id],
              (err, uResult) => {
                if (err) {
                  helper.ThrowHtmlError(err, res);
                  return;
                }

                if (uResult.affectedRows > 0) {
                  res.json({ status: "1", message: msg_success });
                } else {
                  res.json({
                    status: "0",
                    message: msg_fail,
                  });
                }
              }
            );
          } else {
            res.json({
              status: "0",
              message: "user not exits",
            });
          }
        }
      );
    });
  });

  app.post("/api/app/forgot_password_verify", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    helper.CheckParameterValid(res, reqObj, ["email", "reset_code"], () => {
      db.query(
        "SELECT `user_id` FROM `user_detail` WHERE `email` = ? AND `reset_code` ",
        [reqObj.email, reqObj.reset_code],
        (err, result) => {
          if (err) {
            helper.ThrowHtmlError(err, res);
            return;
          }

          if (result.length > 0) {
            var reset_code = helper.createNumber();
            db.query(
              "UPDATE `user_detail` SET `reset_code` = ? WHERE `user_id` = ? ",
              [reset_code, result[0].user_id],
              (err, uResult) => {
                if (err) {
                  helper.ThrowHtmlError(err, res);
                  return;
                }

                if (uResult.affectedRows > 0) {
                  res.json({
                    status: "1",
                    payload: {
                      user_id: result[0].user_id,
                      reset_code: reset_code,
                    },
                    message: msg_success,
                  });
                } else {
                  res.json({
                    status: "0",
                    message: msg_fail,
                  });
                }
              }
            );
          } else {
            res.json({
              status: "0",
              message: "user not exits",
            });
          }
        }
      );
    });
  });

  app.post("/api/app/forgot_password_set_password", (req, res) => {
    helper.Dlog(req.body);
    var reqObj = req.body;

    helper.CheckParameterValid(
      res,
      reqObj,
      ["user_id", "reset_code", "new_password"],
      () => {
        var reset_code = helper.createNumber();
        db.query(
          "UPDATE `user_detail` SET `password` = ? , `reset_code` = ?  WHERE `user_id` = ? AND `reset_code` = ? ",
          [reqObj.new_password, reset_code, reqObj.user_id, reqObj.reset_code],
          (err, uResult) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (uResult.affectedRows > 0) {
              res.json({
                status: "1",
                message: "update password successfully",
              });
            } else {
              res.json({
                status: "0",
                message: msg_fail,
              });
            }
          }
        );
      }
    );
  });

  app.post("/api/app/add_coin_review", (req, res) => {
    const { user_id } = req.body;

    // Check if user_id and order_id are provided
    if (!user_id) {
      res.json({
        status: "0",
        message: "User ID is required",
      });
      return;
    }

    // Query to update coin for the user
    db.query(
      "UPDATE `user_detail` SET `coin` = `coin` + 1 WHERE `user_id` = ?",
      [user_id],
      (err, result) => {
        if (err) {
          helper.ThrowHtmlError(err, res);
          return;
        }

        if (result.affectedRows > 0) {
          res.json({
            status: "1",
            message: "Coin added successfully",
          });
        } else {
          res.json({
            status: "0",
            message: "Failed to add coin",
          });
        }
      }
    );
  });

  app.post("/api/app/use_coin_for_order", (req, res) => {
    const { user_id } = req.body;

    // Check if user_id and order_id are provided
    if (!user_id) {
      res.json({
        status: "0",
        message: "User ID is required",
      });
      return;
    }

    // Query to check if the user has enough coins
    db.query(
      "SELECT `coin` FROM `user_detail` WHERE `user_id` = ?",
      [user_id],
      (err, result) => {
        if (err) {
          helper.ThrowHtmlError(err, res);
          return;
        }

        // Check if the user has enough coins
        const userCoin = result[0].coin;
        if (userCoin < 1) {
          res.json({
            status: "0",
            message: "Not enough coins to use for this order",
          });
          return;
        }

        // Update the user's coin balance by subtracting 1 coin
        db.query(
          "UPDATE `user_detail` SET `coin` = `coin` - 1 WHERE `user_id` = ?",
          [user_id],
          (err, updateResult) => {
            if (err) {
              helper.ThrowHtmlError(err, res);
              return;
            }

            if (updateResult.affectedRows > 0) {
              res.json({
                status: "1",
                message: "Coin used successfully for this order",
              });
            } else {
              res.json({
                status: "0",
                message: "Failed to use coin for this order",
              });
            }
          }
        );
      }
    );
  });

  function getProductDetail(res, prod_id, user_id) {
    db.query(
      "SELECT `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`, `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, `pd`.`created_date`, `pd`.`modify_date`, `cd`.`cat_name`, ( CASE WHEN `fd`.`fav_id` IS NOT NULL THEN 1 ELSE 0 END ) AS `is_fav` , IFNULL( `bd`.`brand_name`, '' ) AS `brand_name` , `td`.`type_name`, IFNULL(`od`.`price`, `pd`.`price` ) as `offer_price`, (CASE WHEN `imd`.`image` != '' THEN  CONCAT( '" +
        image_base_url +
        "' ,'', `imd`.`image` ) ELSE '' END) AS `image`, IFNULL(`od`.`start_date`,'') as `start_date`, IFNULL(`od`.`end_date`,'') as `end_date`, (CASE WHEN `od`.`offer_id` IS NOT NULL THEN 1 ELSE 0 END) AS `is_offer_active` FROM `product_detail` AS  `pd` " +
        "INNER JOIN `category_detail` AS `cd` ON `pd`.`cat_id` = `cd`.`cat_id` " +
        "INNER JOIN `image_detail` AS `imd` ON `pd`.`prod_id` = `imd`.`prod_id` AND `imd`.`status` = 1 " +
        "LEFT JOIN  `favorite_detail` AS `fd` ON  `pd`.`prod_id` = `fd`.`prod_id` AND `fd`.`user_id` = ? AND `fd`.`status`=  1 " +
        "LEFT JOIN `brand_detail` AS `bd` ON `pd`.`brand_id` = `bd`.`brand_id` " +
        "LEFT JOIN `offer_detail` AS `od` ON `pd`.`prod_id` = `od`.`prod_id` AND `od`.`status` = 1 AND `od`.`start_date` <= NOW() AND `od`.`end_date` >= NOW() " +
        "INNER JOIN `type_detail` AS `td` ON `pd`.`type_id` = `td`.`type_id` " +
        " WHERE `pd`.`status` = ? AND `pd`.`prod_id` = ? GROUP BY `fd`.`fav_id`, `pd`.`prod_id`, `pd`.`cat_id`, `pd`.`brand_id`, `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, `pd`.`created_date`, `pd`.`modify_date`, `cd`.`cat_name`, `bd`.`brand_name`, `td`.`type_name`, `od`.`price`, `pd`.`price`, `od`.`start_date`, `od`.`end_date`, `imd`.`image`, `od`.`offer_id`; " +
        " SELECT `nutrition_id`, `prod_id`, `nutrition_name`, `nutrition_value` FROM `nutrition_detail` WHERE `prod_id` = ? AND `status` = ? ORDER BY `nutrition_name`;" +
        "SELECT `img_id`, `prod_id`, (CASE WHEN `image` != '' THEN  CONCAT( '" +
        image_base_url +
        "' ,'', `image` ) ELSE '' END) AS `image`  FROM `image_detail` WHERE `prod_id` = ? AND `status` = ? ",
      [user_id, "1", prod_id, prod_id, "1", prod_id, "1"],
      (err, result) => {
        if (err) {
          helper.ThrowHtmlError(err, res);
          return;
        }

        // result = result.replace_null()

        // helper.Dlog(result);

        if (result[0].length > 0) {
          result[0][0].nutrition_list = result[1];
          result[0][0].images = result[2];

          res.json({
            status: "1",
            payload: result[0][0],
          });
        } else {
          res.json({ status: "0", message: "invalid item" });
        }
      }
    );
  }

  function getUserCart(res, user_id, callback) {
    db.query(
      "SELECT `ucd`.`cart_id`, `ucd`.`user_id`, `ucd`.`prod_id`, `ucd`.`qty`, `pd`.`cat_id`, `pd`.`brand_id`, `pd`.`type_id`, `pd`.`name`, `pd`.`detail`, `pd`.`unit_name`, `pd`.`unit_value`, `pd`.`nutrition_weight`, `pd`.`price`, `pd`.`created_date`, `pd`.`modify_date`, `cd`.`cat_name`, ( CASE WHEN `fd`.`fav_id` IS NOT NULL THEN 1 ELSE 0 END ) AS `is_fav` , IFNULL( `bd`.`brand_name`, '' ) AS `brand_name` , `td`.`type_name`, IFNULL(`od`.`price`, `pd`.`price` ) as `offer_price`, IFNULL(`od`.`start_date`,'') as `start_date`, IFNULL(`od`.`end_date`,'') as `end_date`, (CASE WHEN `od`.`offer_id` IS NOT NULL THEN 1 ELSE 0 END) AS `is_offer_active`, (CASE WHEN `imd`.`image` != '' THEN  CONCAT( '" +
        image_base_url +
        "' ,'', `imd`.`image` ) ELSE '' END) AS `image`, (CASE WHEN `od`.`price` IS NULL THEN `pd`.`price` ELSE `od`.`price` END) as `item_price`, ( (CASE WHEN `od`.`price` IS NULL THEN `pd`.`price` ELSE `od`.`price` END) * `ucd`.`qty`)  AS `total_price` FROM `cart_detail` AS `ucd` " +
        "INNER JOIN `product_detail` AS `pd` ON `pd`.`prod_id` = `ucd`.`prod_id` AND `pd`.`status` = 1  " +
        "INNER JOIN `category_detail` AS `cd` ON `pd`.`cat_id` = `cd`.`cat_id` " +
        "LEFT JOIN  `favorite_detail` AS `fd` ON  `pd`.`prod_id` = `fd`.`prod_id` AND `fd`.`user_id` = ? AND `fd`.`status`=  1 " +
        "LEFT JOIN `brand_detail` AS `bd` ON `pd`.`brand_id` = `bd`.`brand_id` " +
        "LEFT JOIN `offer_detail` AS `od` ON `pd`.`prod_id` = `od`.`prod_id` AND `od`.`status` = 1 AND `od`.`start_date` <= NOW() AND `od`.`end_date` >= NOW() " +
        "INNER JOIN `image_detail` AS `imd` ON `pd`.`prod_id` = `imd`.`prod_id` AND `imd`.`status` = 1 " +
        "INNER JOIN `type_detail` AS `td` ON `pd`.`type_id` = `td`.`type_id` " +
        "WHERE `ucd`.`user_id` = ? AND `ucd`.`status` = ? GROUP BY `ucd`.`cart_id`, `pd`.`prod_id`, `fd`.`fav_id`, `od`.`price`, `od`.`start_date`, `od`.`end_date`,`od`.`offer_id`,`imd`.`image`; ",
      [user_id, user_id, "1"],
      (err, result) => {
        if (err) {
          helper.ThrowHtmlError(err, res);
          return;
        }

        var total = result
          .map((cObj) => {
            return cObj.total_price;
          })
          .reduce((patSum, a) => patSum + a, 0);

        return callback(result, total);
      }
    );
  }
};

function checkAccessToken(headerObj, res, callback, require_type = "") {
  helper.Dlog(headerObj.access_token);
  helper.CheckParameterValid(res, headerObj, ["access_token"], () => {
    db.query(
      "SELECT `user_id`, `username`, `user_type`, `name`, `email`, `mobile`, `mobile_code`,  `auth_token`, `dervice_token`, `status` FROM `user_detail` WHERE `auth_token` = ? AND `status` = ? ",
      [headerObj.access_token, "1"],
      (err, result) => {
        if (err) {
          helper.ThrowHtmlError(err, res);
          return;
        }

        helper.Dlog(result);

        if (result.length > 0) {
          if (require_type != "") {
            if (require_type == result[0].user_type) {
              return callback(result[0]);
            } else {
              res.json({
                status: "0",
                code: "404",
                message: "Access denied. Unauthorized user access.",
              });
            }
          } else {
            return callback(result[0]);
          }
        } else {
          res.json({
            status: "0",
            code: "404",
            message: "Access denied. Unauthorized user access.",
          });
        }
      }
    );
  });
}
