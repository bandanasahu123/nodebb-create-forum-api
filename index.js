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
var getForumURL = '/api/forum/v1/read'
var {
  createCategory,
  addPrivileges,
  addSection,
  createForum,
  createGroup,
  getForum
} = require('./library')

async function setupOrgAPI (req, res) {
  console.log('------------ cretae teant ----------', req.body)
  let { body } = req
  var reqPrivileges = body.request.privileges
  return createCategory(body.request)
    .then(catResponse => {
      if (catResponse) {
        let allCatIds = []
        catResponse.sectionObj.map(section => {
          allCatIds.push(section.cid)
        })
        allCatIds.push(catResponse.categoryObj.cid)
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

  if (!body.request.organisationId && !body.request.context) {
    let resObj = {
      id: 'api.discussions.forum.create',
      msgId: req.body.params.msgid,
      status: 'failed',
      resCode: 'SERVER_ERROR',
      err: 401,
      errmsg: 'Please provide orgId or context! something is missing'
    }
    return res.json(responseMessage.errorResponse(resObj))
  } else {
    return createForum(body.request)
      .then(catResponse => {
        let allCatIds = []
        allCatIds.push(catResponse.cid)
        if (body.request.groups && body.request.privileges) {
          return createGroup(body.request, allCatIds)
            .then(groupObj => {
              console.log('------groupObj-----', groupObj)
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
        } else if (body.request.groups && !body.request.privileges) {
          return createGroup(body.request, allCatIds)
            .then(groupObj => {
              console.log('------groupObj-----', groupObj)
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
        } else if (!body.request.groups && body.request.privileges) {
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
        } else {
          let resObj = {
            id: 'api.discussions.forum.create',
            msgId: req.body.params.msgid,
            status: 'successful',
            resCode: 'OK',
            data: catResponse
          }
          return res.json(responseMessage.successResponse(resObj))
        }
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
}

async function getForumAPI (req, res) {
  console.log('------------ api.discussions.forum.read----------', req.body)
  let { body } = req
  return getForum(body.request)
    .then(forumResponse => {
      console.log('-------------forumResponse', forumResponse)
      let resObj = {
        id: 'api.discussions.forum.read',
        msgId: req.body.params.msgid,
        status: 'successful',
        resCode: 'OK',
        data: forumResponse
      }
      return res.json(responseMessage.successResponse(resObj))
    })
    .catch(error => {
      let resObj = {
        id: 'api.discussions.forum.read',
        msgId: req.body.params.msgid,
        status: 'failed',
        resCode: 'SERVER_ERROR',
        err: error.status,
        errmsg: error.message
      }

      return res.json(responseMessage.errorResponse(resObj))
    })
}

function commonObject (res, id, msgId, status, resCode, err, errmsg, data) {
  let resObj = null
  if (res === 0) {
    resObj = {
      id: id,
      msgId: msgId,
      status: status,
      resCode: resCode,
      err: err,
      errmsg: errmsg
    }
  } else {
    resObj = {
      id: id,
      msgId: msgId,
      status: status,
      resCode: resCode,
      data: data
    }
  }
  return resObj
}

Plugin.load = function (params, callback) {
  var router = params.router

  router.post(
    createForumURL,
    apiMiddleware.requireUser,
    apiMiddleware.requireAdmin,
    createForumAPI
  )
  router.post(
    getForumURL,
    apiMiddleware.requireUser,
    apiMiddleware.requireAdmin,
    getForumAPI
  )
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
