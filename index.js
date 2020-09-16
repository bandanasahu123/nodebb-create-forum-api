var Plugin = (module.exports = {})
var Categories = require.main.require('./src/categories')
var Groups = require.main.require('./src/groups')
var db = require.main.require('./src/database')
var Users = require.main.require('./src/user')
var async = require('async')

function createForum (req, res, next) {
  console.log('------------------ createForum --------------------', req.body)
  let { body } = req
  const reqData = {
    name: `${body.course_name}(${body.batch_start_date} - ${body.batch_end_date})`,
    parentCid: body.parentCid || ''
  }
  return new Promise(function (resolve, reject) {
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
          Promise.all([group, mapping])
            .then(responnse => {
				console.log('-------------------promise all response------------------')
			})
            .catch(err => {
              return reject(err)
            })
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
}

function createGroup (body, catObj) {
  return new Promise(function (resolve, reject) {
    let groupNameArr = [
      `moderator-${body.course_name}`,
      `general-${body.course_name}`
    ]
    groupNameArr.map((groupName, inx) => {
      console.log('----------groupName----------', groupName)
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

function addUserIntoGroup (body, groupName, catObj) {
  return new Promise(function (resolve, reject) {
    body.moderators.map(uid => {
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
      .then(res => {})
      .catch(err => {
        return reject({
          status: 400,
          message: 'Error in adding users previliges into category',
          Error: err
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
    console.log('------------------', err)
    console.log('------------uid>>>>>>>>>>>uid------', uid)
    if (uid) {
      let jsonObj = {
        _key: `sunbird_nodebb_user_map:${uid}`,
        uid: uid,
        sunbird_id: req.body.sunbirdid
      }
      mappingFunction(`user:${uid}`, jsonObj)
    }
    // return errorHandler.handle(err, res, {
    // 	uid: uid
    // });
  })
}

Plugin.load = function (params, callback) {
  console.log('-----------------', params, '-------------------------')
  var router = params.router

  router.post('/api/create-forum', createForum)
  router.post('/api/create-user', createUser)
  callback()
}
