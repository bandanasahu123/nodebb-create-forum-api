var Plugin = (module.exports = {})
var Categories = require.main.require('./src/categories')
var Groups = require.main.require('./src/groups')
var db = require.main.require('./src/database')
var Users = require.main.require('./src/user')
var async = require('async')

function createForum (req, res, next) {
  console.log('------------------ createForum --------------------', req.body)
  let { body } = req
  let name = body.course_name
  if (!body.course_name) return res.send('Please provide the course name')
  if (!body.tenant_id) return res.send('Please provide your tenent ID')
  if (!body.batch_id) return res.send('Please provide your batch ID')

  if (body.batch_start_date && body.batch_end_date) {
    name = `${body.course_name}(${body.batch_start_date} - ${body.batch_end_date})`
  } else if (body.batch_start_date && !body.batch_end_date) {
    name = `${body.course_name}(${body.batch_start_date})`
  } else {
    name = name
  }

  return new Promise(function (resolve, reject) {
    // fetch the parentcid from db using tenant name and tenent id
    db.getObject(`tenant_cat_map:` + body.tenant_id)
      .then(tenentObj => {
        let pID = tenentObj && tenentObj.cat_id ? tenentObj.cat_id : ''

        const reqData = {
          name: name,
          parentCid: pID
        }

        Categories.create(reqData)
          .then(categoryObj => {
            if (categoryObj) {
              let jsonObj = {
                _key: `batchid_catid_map:${categoryObj.cid}`,
                batch_id: body.batch_id,
                cat_id: categoryObj.cid
              }
              let group = createGroup(body, categoryObj)
              let mapping = mappingFunction(`batch:${body.batch_id}`, jsonObj)

              if (!pID) {
                let jsonTenanatObj = {
                  cat_id: categoryObj.cid,
                  tenant_id: body.tenant_id,
                  name: body.course_name
                }

                var mappingTenant = mappingFunction(
                  `tenant_cat_map:${body.tenant_id}`,
                  jsonTenanatObj
                )
              }

              let responseDta = Promise.all([group, mapping, mappingTenant])
                .then(responnse => {
                  return resolve(responnse)
                })
                .catch(err => {
                  return reject(err)
                })

              if (responseDta) {
                return res.json({
                  status: 200,
                  message: 'Successfully created forum / tenant!'
                })
              }
            }
          })
          .catch(err => {
            return reject({
              status: 400,
              message: 'Error in inserting category',
              error: err
            })
          })
      })
      .catch(err => {
        return reject({
          err: err
        })
      })
  })
}

function createGroup (body, catObj) {
  return new Promise(function (resolve, reject) {
    let groupNameArr = [`batch-${body.batch_id}`]
    groupNameArr.map((groupName, inx) => {
      Groups.create({ name: groupName })
        .then(groupObj => {
          if (groupObj) {
            return addUserIntoGroup(body, groupName, catObj)
          }
        })
        .catch(err => {
          return reject({
            status: 400,
            message: 'Error in inserting groups',
            Error: err
          })
        })
    })
  })
}

async function addUserIntoGroup (body, groupName, catObj) {
  return new Promise(function (resolve, reject) {
    body.moderators
      .map(sunbirdAuthId => {
        return getUserIdFromOauthId(sunbirdAuthId).then(uid => {
          if (uid) {
            Groups.join(groupName, uid)
              .then(data => {
                return addUserPreviliges(body, uid, catObj)
              })
              .catch(err => {
                return reject({
                  status: 400,
                  message: 'Error in adding users into groups',
                  Error: err
                })
              })
          } else {
            console.log(
              '---------- no user id found ---------------',
              sunbirdAuthId
            )
          }
        })
      })
      .catch(err => {
        return reject(err)
      })
  })
}

function addUserPreviliges (body, uid, catObj) {
  return new Promise(function (resolve, reject) {
    let groups = [uid]
    let privileges = [
      'topics:read',
      'read',
      'find',
      'topics:create',
      'topics:reply',
      'topics:tag',
      'posts:edit',
      'posts:history',
      'posts:delete',
      'posts:upvote',
      'posts:downvote',
      'topics:delete',
      'posts:view_deleted',
      'purge',
      'moderate'
    ]

    changeGroupMembership(catObj.cid, privileges, groups, 'join')
      .then(res => {
        return removeuserPreviliges(catObj.cid)
      })
      .catch(err => {
        return reject({
          status: 400,
          message: 'Error in adding users previliges into category',
          Error: err
        })
      })
  })
}

function removeuserPreviliges (cid) {
  let delgroupData = ['registered-users', 'guests', 'spiders']
  let previligesArray = null
  return new Promise(function (resolve, reject) {
    delgroupData.map(name => {
      name.includes('users')
        ? (previligesArray = [
            'groups:topics:read',
            'groups:read',
            'groups:find',
            'groups:topics:create',
            'groups:topics:reply',
            'groups:topics:tag',
            'groups:posts:edit',
            'groups:posts:history',
            'groups:posts:delete',
            'groups:posts:upvote',
            'groups:posts:downvote',
            'groups:topics:delete',
            'groups:posts:view_deleted',
            'groups:purge',
            'groups:moderate'
          ])
        : (previligesArray = [
            'groups:read',
            'groups:find',
            'groups:topics:read'
          ])
      changeGroupMembership(cid, previligesArray, name, 'leave')
        .then(data => {
          return resolve(data)
        })
        .catch(err => {
          return reject({
            err: err
          })
        })
    })
  })
}

async function changeGroupMembership (
  cid,
  privileges,
  groups,
  action,
  callback
) {
  privileges = Array.isArray(privileges) ? privileges : [privileges]
  groups = Array.isArray(groups) ? groups : [groups]

  async.each(
    groups,
    function (group, groupCb) {
      async.each(
        privileges,
        function (privilege, privilegeCb) {
          Groups[action](
            'cid:' + cid + ':privileges:' + privilege,
            group,
            privilegeCb
          )
        },
        groupCb
      )
    },
    callback
  )
}

async function mappingFunction (key, obj) {
  let res = await db.setObject(key, obj)
  return res
}

function createUser (req, res, next) {
  Users.create(req.body, function (err, uid) {
    if (uid) {
      let jsonObj = {
        [req.body.oauth_id]: uid
      }
      mappingFunction(`sunbird-oidcId:uid`, jsonObj)
      res.json({ status: 200, messsage: 'Successfully user created!' })
    }
  })
}

function findKey (req, res, next) {
  db.getObject(req.body.key, (err, response) => {
    if (err) throw err
    return res.send(response)
  })
}

async function getUserIdFromOauthId (sunbirdId) {
  let uid = await db.getObjectField('sunbird-oidcId:uid', sunbirdId)
  return uid
}

Plugin.load = function (params, callback) {
  var router = params.router

  router.post('/api/create-forum', createForum)
  router.post('/api/create-user', createUser)
  router.post('/api/fetch-map-data', findKey)
  router.post('/api/create-tenant', createForum)
  callback()
}
