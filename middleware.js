'use strict'

const jwt = require('jsonwebtoken')
const async = require('async')

const passport = require.main.require('passport')
const nconf = require.main.require('nconf')

const user = require.main.require('./src/user')
// const plugins = require.main.require('./src/plugins')

const errorHandler = require('./lib/errorHandler')
// const utils = require('./utils');

const Middleware = {
  regexes: {
    tokenRoute: new RegExp(
      '^' +
        nconf.get('relative_path') +
        '\\/api\\/v\\d+\\/users\\/(\\d+)\\/tokens$'
    )
  }
}

Middleware.requireUser = async function (req, res, next) {
  var routeMatch

  // await plugins.fireHook('response:plugin.write-api.authenticate', {
  // 	req: req,
  // 	res: res,
  // 	next: function () {},	// noop for backwards compatibility purposes
  // 	utils: utils,
  // 	errorHandler: errorHandler,
  // });

  // If plugins handle the response, stop default actions
  if (res.headersSent) {
    return
  }

  if (req.headers.hasOwnProperty('authorization')) {
    passport.authenticate('bearer', { session: false }, function (err, user) {
      console.log(
        '-------------- line - 44 , user response -----------------',
        user
      )
      if (err) {
        return next(err)
      }
      if (!user) {
        return errorHandler.respond(401, res)
      }

      // If the token received was a master token, a _uid must also be present for all calls
      if (user.hasOwnProperty('uid')) {
        req.login(user, function (err) {
          if (err) {
            return errorHandler.respond(500, res)
          }

          req.uid = user.uid
          req.loggedIn = req.uid > 0
          next()
        })
      } else if (user.hasOwnProperty('master') && user.master === true) {
        // if (
        //   req.body.hasOwnProperty('_uid') ||
        //   req.query.hasOwnProperty('_uid')
        // )
        // {
        user.uid = req.body._uid || req.query._uid || 1
        delete user.master

        req.login(user, function (err) {
          if (err) {
            return errorHandler.respond(500, res)
          }

          req.uid = user.uid
          req.loggedIn = req.uid > 0
          next()
        })
        // } else {
        //   res
        //     .status(400)
        //     .json(
        //       errorHandler.generate(
        //         400,
        //         'params-missing',
        //         'Required parameters were missing from this API call, please see the "params" property',
        //         ['_uid']
        //       )
        //     )
        // }
      } else {
        return errorHandler.respond(500, res)
      }
    })(req, res, next)
  } else if (
    (routeMatch = req.originalUrl.match(Middleware.regexes.tokenRoute))
  ) {
    // If token generation route is hit, check password instead
    if (!utils.checkRequired(['password'], req, res)) {
      return false
    }

    var uid = routeMatch[1]

    user.isPasswordCorrect(uid, req.body.password, req.ip, function (err, ok) {
      if (!err && ok) {
        req.login({ uid: parseInt(uid, 10) }, function (err) {
          if (err) {
            return errorHandler.respond(500, res)
          }

          req.uid = user.uid
          req.loggedIn = req.uid > 0
          next()
        })
      } else {
        errorHandler.respond(401, res)
      }
    })
  } else {
    // No bearer token, jwt, or special handling instructions, transparently pass-through
    next()
  }
}

Middleware.requireAdmin = function (req, res, next) {
  if (!req.user) {
    return errorHandler.respond(401, res)
  }
  user.isAdministrator(req.user.uid, function (err, isAdmin) {
    if (err || !isAdmin) {
      return errorHandler.respond(403, res)
    }

    next()
  })
}

module.exports = Middleware
