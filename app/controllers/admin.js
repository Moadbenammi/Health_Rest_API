const Admin = require("../models/Admin");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
var async = require("async");
var crypto = require("crypto");
const { smtpTransport, email } = require("../config/email");
const { RESET_PASSWORD_URL, TOKEN_SECRET } = require("../config/config");

exports.signup = (req, res, next) => {
  bcrypt
    .hash(req.body.password, 10)
    .then((hash) => {
      const admin = new Admin({
        fullName: {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
        },
        email: req.body.email,
        password: hash,
      });
      admin
        .save()
        .then(() => res.status(201).json({ message: "Admin created!" }))
        .catch((error) => res.status(400).json({ error }));
    })
    .catch((error) => res.status(500).json({ error }));
};

exports.login = (req, res, next) => {
  Admin.findOne({ email: req.body.email })
    .then((admin) => {
      if (!admin) {
        return res.status(401).json({ error: "admin not found!" });
      }
      bcrypt
        .compare(req.body.password, admin.password)
        .then((valid) => {
          if (!valid) {
            return res.status(401).json({ error: "Worng password" });
          }
          res.status(200).json({
            adminId: admin._id,
            token: jwt.sign(
              { adminId: admin._id, role: "admin" },
              TOKEN_SECRET,
              {
                expiresIn: "24h",
              }
            ),
          });
        })
        .catch((error) => res.status(500).json({ error }));
    })
    .catch((error) => res.status(500).json({ error }));
};

exports.forgetPassword = function (req, res) {
  async.waterfall(
    [
      function (done) {
        Admin.findOne({
          email: req.body.email,
        }).exec(function (err, admin) {
          if (admin) {
            done(err, admin);
          } else {
            done({ error: "Admin not found" });
          }
        });
      },
      function (admin, done) {
        // create the random token
        crypto.randomBytes(20, function (err, buffer) {
          var token = buffer.toString("hex");
          done(err, admin, token);
        });
      },
      function (admin, token, done) {
        Admin.findByIdAndUpdate(
          { _id: admin._id },
          {
            reset_password_token: token,
            reset_password_expires: Date.now() + 86400000,
          },
          { upsert: true, new: true }
        ).exec(function (err, new_admin) {
          done(err, token, new_admin);
        });
      },
      function (token, admin, done) {
        var data = {
          to: admin.email,
          from: email,
          template: "forgot_password_email",
          subject: "Password help has arrived!",
          context: {
            url: RESET_PASSWORD_URL + token,
            name: admin.fullName.firstName,
          },
        };

        smtpTransport.sendMail(data, function (err) {
          if (!err) {
            return res.json({
              message: "Kindly check your email for further instructions",
            });
          } else {
            return done(err);
          }
        });
      },
    ],
    function (err) {
      return res.status(422).json({ err });
    }
  );
};

exports.resetPassword = function (req, res, next) {
  Admin.findOne({
    reset_password_token: req.query.token,
  }).exec(function (err, admin) {
    if (!err && admin) {
      if (req.body.newPassword === req.body.verifyPassword) {
        admin.password = bcrypt.hashSync(req.body.newPassword, 10);
        admin.reset_password_token = undefined;
        admin.reset_password_expires = undefined;
        admin.save(function (err) {
          if (err) {
            return res.status(422).json(err);
          } else {
            var data = {
              to: admin.email,
              from: email,
              template: "reset_password_email",
              subject: "Password Reset Confirmation",
              context: {
                name: admin.fullName.firstName,
              },
            };

            smtpTransport.sendMail(data, function (err) {
              if (!err) {
                return res.json({ message: "Password reset" });
              } else {
                return done(err);
              }
            });
          }
        });
      } else {
        return res.status(422).send({
          message: "Passwords do not match",
        });
      }
    } else {
      return res.status(400).send({
        message: "Password reset token is invalid or has expired.",
      });
    }
  });
};

exports.getAdmins = (req, res) => {
  Admin.find({})
    .then((admins) => res.status(200).json(admins))
    .catch(() => res.status(404).json({ error: "Admins Not Found" }));
};

exports.getAdminById = (req, res) => {
  Admin.findOne({ _id: req.params.adminId })
    .then((admin) => res.status(200).json(admin))
    .catch(() => res.status(404).json({ error: "Admin Not Found" }));
};

exports.updateAdmin = (req, res) => {
  Admin.updateOne({ _id: req.params.adminId }, req.body)
    .thenn(res.status(200).json({ message: "Admin updated successfully" }))
    .catch((err) => res.status(500).json(err));
};

exports.deleteAdmin = (req, res) => {
  Admin.deleteOne({ _id: req.params.adminId })
    .then(res.status(200).json({ message: "Admin deleted successfully" }))
    .catch((err) => res.status(500).json(err));
};
