var Plugin = (module.exports = {})
var Categories = require.main.require('./src/categories')
var Groups = require.main.require('./src/groups')
var db = require.main.require('./src/database')
var Users = require.main.require('./src/user')
var async = require('async')
var apiMiddleware = require('./middleware')
var responseMessage = require('./responseHandler')
var createTenantURL = '/api/org/v1/setup'
var createForumURL = '/api/forum/v1/create'
var createSectionURL = '/api/org/v1/sections/add'
var { createCategory, addPrivileges, addSection } = require('./library')

async function setupOrgAPI (req, res) {
  console.log('------------ cretae teant ----------', req.body)
  let { body } = req
  var reqPrivileges = body.request.privileges
  return createCategory(body.request)
    .then(catResponse => {
      if (catResponse) {
        console.log('------catResponse-----', catResponse)
        let allCatIds = []
        catResponse.sectionObj.map(section => {
          allCatIds.push(section.cid)
        })
        allCatIds.push(catResponse.categoryObj.cid)
        console.log(allCatIds, '>>>>>>>>>>>>>>>>>>>>>>>')
        return addPrivileges(reqPrivileges, allCatIds)
          .then(privilegesResponse => {
            console.log(
              '---------privilegesResponse00 -----------',
              privilegesResponse
            )
            let resObj = {
              id: 'api.discussions.org.setup',
              msgId: req.body.params.msgid,
              status: 'successful',
              resCode: 'OK',
              data: catResponse
            }
            return res.json(responseMessage.successResponse(resObj))
          })
          .catch(error => {
            let resObj = {
              id: 'api.discussions.org.setup',
              msgId: req.body.params.msgid,
              status: 'failed',
              resCode: 'SERVER_ERROR',
              err: error.status,
              errmsg: error.message
            }
            return res.json(responseMessage.errorResponse(resObj))
          })
      }
    })
    .catch(error => {
      let resObj = {
        id: 'api.discussions.org.setup',
        msgId: req.body.params.msgid,
        status: 'failed',
        resCode: 'SERVER_ERROR',
        err: error.status,
        errmsg: error.message
      }
      return res.json(responseMessage.errorResponse(resObj))
    })
}

async function addSectionURL (req, res) {
  console.log('------------ /api/org/v1/sections/add ----------', req.body)
  let { body } = req
  var reqPrivileges = body.request.privileges
  return addSection(body.request)
    .then(catResponse => {
      console.log('------catResponse-----', catResponse)
      let allCatIds = []
      catResponse.sectionObj.map(section => {
        allCatIds.push(section.cid)
      })
      console.log(allCatIds, '>>>>>>>>>>>>>>>>>>>>>>>')
      return addPrivileges(reqPrivileges, allCatIds)
        .then(privilegesResponse => {
          let resObj = {
            id: 'api.discussions.org.section.add',
            msgId: req.body.params.msgid,
            status: 'successful',
            resCode: 'OK',
            data: catResponse
          }
          return res.json(responseMessage.successResponse(resObj))
        })
        .catch(error => {
          let resObj = {
            id: 'api.discussions.org.section.add',
            msgId: req.body.params.msgid,
            status: 'failed',
            resCode: 'SERVER_ERROR',
            err: error.status,
            errmsg: error.message
          }
          return res.json(responseMessage.errorResponse(resObj))
        })
    })
    .catch(error => {
      let resObj = {
        id: 'api.discussions.org.section.add',
        msgId: req.body.params.msgid,
        status: 'failed',
        resCode: 'SERVER_ERROR',
        err: error.status,
        errmsg: error.message
      }
      return res.json(responseMessage.errorResponse(resObj))
    })
}

async function createForumAPI (req, res) {
  console.log('------------ api.discussions.forum.create----------', req.body)
  let { body } = req
  var reqPrivileges = body.request.privileges
  return createForum(body.request)
    .then(catResponse => {
      console.log('------catResponse-----', catResponse)
      let allCatIds = []
      catResponse.sectionObj.map(section => {
        allCatIds.push(section.cid)
      })
      console.log(allCatIds, '>>>>>>>>>>>>>>>>>>>>>>>')
      return addPrivileges(reqPrivileges, allCatIds)
        .then(privilegesResponse => {
          let resObj = {
            id: 'api.discussions.forum.create',
            msgId: req.body.params.msgid,
            status: 'successful',
            resCode: 'OK',
            data: catResponse
          }
          return res.json(responseMessage.successResponse(resObj))
        })
        .catch(error => {
          let resObj = {
            id: 'api.discussions.forum.create',
            msgId: req.body.params.msgid,
            status: 'failed',
            resCode: 'SERVER_ERROR',
            err: error.status,
            errmsg: error.message
          }
          return res.json(responseMessage.errorResponse(resObj))
        })
    })
    .catch(error => {
      let resObj = {
        id: 'api.discussions.forum.create',
        msgId: req.body.params.msgid,
        status: 'failed',
        resCode: 'SERVER_ERROR',
        err: error.status,
        errmsg: error.message
      }
      return res.json(responseMessage.errorResponse(resObj))
    })
}

Plugin.load = function (params, callback) {
  var router = params.router

  router.post(
    createForumURL,
    apiMiddleware.requireUser,
    apiMiddleware.requireAdmin,
    createForumAPI
  )
  // router.post(
  //   '/api/create-user',
  //   apiMiddleware.requireUser,
  //   apiMiddleware.requireAdmin,
  //   createUser
  // )
  // router.post('/api/fetch-map-data', findKey)
  router.post(
    createTenantURL,
    apiMiddleware.requireUser,
    apiMiddleware.requireAdmin,
    setupOrgAPI
  )
  router.post(
    createSectionURL,
    apiMiddleware.requireUser,
    apiMiddleware.requireAdmin,
    addSectionURL
  )
  callback()
}
