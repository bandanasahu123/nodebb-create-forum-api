var Plugin = (module.exports = {})
var Categories = require.main.require('./src/categories')
var Groups = require.main.require('./src/groups')
var db = require.main.require('./src/database')
var Users = require.main.require('./src/user')
var async = require('async')
var apiMiddleware = require('./middleware')

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
                // _key: `batchid_catid_map:${categoryObj.cid}`,
                batch_id: body.batch_id,
                cat_id: categoryObj.cid
              }
              let group = createGroup(body, categoryObj)
              let mapping = mappingFunction(
                `batchid_catid_map:${body.batch_id}`,
                jsonObj
              )

              if (!pID) {
                // let allcatIds= await db.getObject(`tenant_cat_map:` + body.tenant_id)
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
            addUserIntoGroup(body, groupName, catObj)
            addGroupIntoCatrgory(body, groupName, catObj)
          }
        })
        .catch(err => {
          console.log('-------------', err)
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
    body.moderators.map(sunbirdAuthId => {
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
    // .catch(err => {
    //   return reject(err)
    // })
  })
}

async function addGroupIntoCatrgory (body, groupName, catObj) {
  return new Promise(function (resolve, reject) {
    let groups = [groupName]
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
      'topics:delete'
    ]

    changeGroupMembership(catObj.cid, privileges, groups, 'join')
      .then(data => {
        return resolve(data)
      })
      .catch(err => {
        return reject({
          status: 400,
          message: 'Error in adding groups previliges into category',
          Error: err
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
    console.log('------------------', err, response)
    return res.send(response)
  })
}

async function getUserIdFromOauthId (sunbirdId) {
  let uid = await db.getObjectField('sunbird-oidcId:uid', sunbirdId)
  return uid
}

Plugin.load = function (params, callback) {
  var router = params.router

  router.post(
    '/api/create-forum',
    apiMiddleware.requireUser,
    apiMiddleware.requireAdmin,
    createForum
  )
  router.post(
    '/api/create-user',
    apiMiddleware.requireUser,
    apiMiddleware.requireAdmin,
    createUser
  )
  router.post('/api/fetch-map-data', findKey)
  router.post(
    '/api/create-tenant',
    apiMiddleware.requireUser,
    apiMiddleware.requireAdmin,
    createForum
  )
  callback()
}

async function createForumAPI (req, res) {
  console.log('------------------ createForum --------------------', req.body)
  let { body } = req
  let name = body.course_name
  if (!body.course_name) {
    let err = responseMessage.errorResponse(
      '',
      400,
      'Please provide your course name!!'
    )
    res.json(err)
  }
  if (!body.tenant_id) {
    let err = responseMessage.errorResponse(
      '',
      400,
      'Please provide your tenent ID!!'
    )
    res.json(err)
  }
  if (!body.batch_id) {
    let err = responseMessage.errorResponse(
      '',
      400,
      'Please provide your batch ID!!'
    )
    res.json(err)
  }

  if (body.batch_start_date && body.batch_end_date) {
    name = `${body.course_name}(${body.batch_start_date} - ${body.batch_end_date})`
  } else if (body.batch_start_date && !body.batch_end_date) {
    name = `${body.course_name}(${body.batch_start_date})`
  } else {
    name = name
  }
  return createForum(body, name)
    .then(categoryObj => {
      if (categoryObj) {
        return createGroup(body, categoryObj, res)
      }
    })
    .catch(error => {
      return res.json(
        responseMessage.errorResponse('', error.status, error.message)
      )
    })
}

function createForum (body, name) {
  return new Promise(function (resolve, reject) {
    // fetch the parentcid from db using tenant name and tenent id
    db.getObject(`tenant_cat_map:` + body.tenant_id)
      .then(tenentObj => {
        let parentid
        let pID = tenentObj && tenentObj.cat_id ? tenentObj.cat_id : ''
        // switch(body.type){
        //     case course:
        //     case quiz:
        //     case annoucements:
        //     case tvshow:
        //     case textbook:
        //     case contentcreation:
        //     case projects:
        // }
        if (body.type.indexOf('course') !== -1) {
          parentid = tenentObj && tenentObj.course_id ? tenentObj.course_id : ''
        } else if (body.type.indexOf('quiz') !== -1) {
          parentid = tenentObj && tenentObj.quiz_id ? tenentObj.quiz_id : ''
        } else if (body.type.indexOf('annoucements') !== -1) {
          parentid =
            tenentObj && tenentObj.announcaments_id
              ? tenentObj.announcaments_id
              : ''
        } else if (body.type.indexOf('tvshow') !== -1) {
          parentid = tenentObj && tenentObj.tvshow_id ? tenentObj.tvshow_id : ''
        } else {
          parentid = pID
        }

        const reqData = {
          name: name,
          parentCid: parentid
        }

        Categories.create(reqData)
          .then(categoryObj => {
            let jsonObj = {
              batch_id: body.batch_id,
              cat_id: categoryObj.cid
            }
            let mapping = mappingFunction(
              `batchid_catid_map:${body.batch_id}`,
              jsonObj
            )
            if (!pID) {
              let catarray = []
              let catObj = {}
              let catNames = body.category_names || [
                'Quiz',
                'Announcements',
                'Course',
                'TV Show',
                'Textbook',
                'Content Creation',
                'VDN Projects'
              ]
              var mappingTenant
              catNames.map((v, i) => {
                const bodyData = {
                  name: v,
                  parentCid: categoryObj.cid
                }
                Categories.create(bodyData)
                  .then(catData => {
                    catarray.push(catData)
                    catObj[v + '_id'] = catData.cid
                    if (catNames.length === catarray.length) {
                      console.log('----------- catObj ----------', catObj)

                      let jsonTenanatObj = {
                        ...catObj,
                        cat_id: categoryObj.cid,
                        tenant_id: body.tenant_id,
                        name: body.course_name
                      }

                      mappingTenant = mappingFunction(
                        `tenant_cat_map:${body.tenant_id}`,
                        jsonTenanatObj
                      )
                    }
                  })
                  .catch(err => {
                    return reject({
                      status: 400,
                      message: 'Error in inserting child category.',
                      error: err
                    })
                  })
              })
            }

            Promise.all([mapping, mappingTenant])
              .then(responnse => {
                return resolve(categoryObj)
              })
              .catch(err => {
                return reject({
                  status: 400,
                  message: 'Error in mapping data.',
                  error: err
                })
              })
          })
          .catch(err => {
            console.log('>>>>>>>> err in inserting category >>>', err)
            return reject({
              status: 400,
              message: 'Error in inserting category',
              error: err
            })
          })
      })
      .catch(err => {
        console.log('>>>>>>> find tenent id error <<<<<<<<', err)
        return reject({
          status: 400,
          message: 'Error in finding tenant id',
          error: err
        })
      })
  })
}

function createGroup (body, catObj, res) {
  return new Promise(function (resolve, reject) {
    let groupNameArr = [`batch-${body.batch_id}`]
    groupNameArr.map((groupName, inx) => {
      Groups.create({ name: groupName })
        .then(groupObj => {
          if (groupObj) {
            return addGroupIntoCatrgory(body, groupName, catObj)
              .then(data => {
                return addUserIntoGroup(body, groupName, catObj, res)
              })
              .catch(error => {
                return res.json(
                  responseMessage.errorResponse('', error.status, error.message)
                )
              })
          }
        })
        .catch(err => {
          console.log('------ group craete error-------', err)
          return reject({
            status: 400,
            message: 'Error in inserting groups/ Already exist',
            error: err
          })
        })
    })
  })
}

async function addGroupIntoCatrgory (body, groupName, catObj) {
  console.log('------------ addGroupIntoCatrgory catObj ---------', catObj)
  return new Promise(function (resolve, reject) {
    let groups = [groupName]
    let privileges = [
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
      'groups:topics:delete'
    ]

    changeGroupMembership(catObj.cid, privileges, groups, 'join')
      .then(data => {
        console.log('--------addGroupIntoCatrgory response--------', data)
        return resolve(data)
      })
      .catch(err => {
        return reject({
          status: 400,
          message: 'Error in adding groups previliges into category',
          error: err
        })
      })
  })
}

async function addUserIntoGroup (body, groupName, catObj, res) {
  console.log('------coming addUserIntoGroup--------------- ')
  return new Promise(function (resolve, reject) {
    if (body.moderators.length > 0) {
      body.moderators.map(sunbirdAuthId => {
        return getUserIdFromOauthId(sunbirdAuthId).then(uid => {
          if (uid) {
            Groups.join(groupName, uid)
              .then(data => {
                return addUserPreviliges(body, uid, catObj, res)
              })
              .catch(err => {
                return res.json({
                  status: 400,
                  message: 'Error in adding users into groups',
                  error: err
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
    } else {
      console.log('no id found---------------------')
    }
  })
}

function addUserPreviliges (body, uid, catObj, res) {
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
      .then(data => {
        return removeuserPreviliges(catObj.cid, res)
      })
      .catch(err => {
        return res.json({
          status: 400,
          message: 'Error in adding users previliges into category',
          Error: err
        })
      })
  })
}

function removeuserPreviliges (cid, res) {
  let delgroupData = ['registered-users', 'guests', 'spiders']
  let previligesArray = null
  let arr = []
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
          arr.push(data)
          if (delgroupData.length === arr.length) {
            let successData = responseMessage.successResponse(
              '',
              200,
              'Successful created tenant'
            )
            return res.json(successData)
          }
        })
        .catch(err => {
          console.log(
            '>>>>>>>>>>>>>> error in removeuserPreviliges <<<<<<<<<<<<',
            err
          )
          return res.json({
            status: 400,
            message: 'Error in removing priviliges',
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

async function getUserIdFromOauthId (sunbirdId) {
  let uid = await db.getObjectField('sunbird-oidcId:uid', sunbirdId)
  return uid
}

function findKey (req, res, next) {
  db.getObject(req.body.key, (err, response) => {
    if (err) throw err
    console.log('------------------', err, response)
    return res.json(response)
  })
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



















          //   sections.map((secName, inx) => {
          //     let name = secName.replace(/\s+/g, '-').toLowerCase()
          //     const bodyData = {
          //       name: secName,
          //       parentCid: pID
          //     }
          //     Categories.create(bodyData)
          //       .then(catData => {
          //         sectionArray.push(catData)
          //         sectionObj[name] = catData.cid
          //         if (sections.length === sectionArray.length) {
          //           let jsonTenanatObj = {
          //             ...sectionObj,
          //             cat_id: pID,
          //             tenant_id: tenantId,
          //             name: tenentObj.name
          //           }

          //           mappingTenant = mappingFunction(
          //             `tenant_cat_map:${tenantId}`,
          //             jsonTenanatObj
          //           )

          //           Promise.all([mappingTenant])
          //             .then(responnse => {
          //               let response = {
          //                 sectionObj: sectionArray
          //               }
          //               return resolve(response)
          //             })
          //             .catch(err => {
          //               return reject({
          //                 status: 400,
          //                 message: 'Error in mapping data.',
          //                 error: err
          //               })
          //             })
          //         }
          //       })
          //       .catch(err => {
          //         console.log(
          //           err,
          //           'error in inserting sectionb --------------------'
          //         )
          //         return reject({
          //           status: 400,
          //           message: 'Error in inserting sections.',
          //           error: err
          //         })
          //       })
          //   })


















             //   sections.map((secName, inx) => {
                  //     let name = secName.replace(/\s+/g, '-').toLowerCase()
                  //     const bodyData = {
                  //       name: secName,
                  //       parentCid: categoryObj.cid
                  //     }
                  //     Categories.create(bodyData)
                  //       .then(catData => {
                  //         sectionArray.push(catData)
                  //         sectionObj[name] = catData.cid
                  //         if (sections.length === sectionArray.length) {
                  //           let jsonTenanatObj = {
                  //             ...sectionObj,
                  //             cat_id: categoryObj.cid,
                  //             tenant_id: tenantId,
                  //             name: body.name
                  //           }

                  //           mappingTenant = mappingFunction(
                  //             `tenant_cat_map:${tenantId}`,
                  //             jsonTenanatObj
                  //           )

                  //           Promise.all([mappingTenant])
                  //             .then(responnse => {
                  //               let response = {
                  //                 categoryObj: categoryObj,
                  //                 sectionObj: sectionArray
                  //               }
                  //               return resolve(response)
                  //             })
                  //             .catch(err => {
                  //               return reject({
                  //                 status: 400,
                  //                 message: 'Error in mapping data.',
                  //                 error: err
                  //               })
                  //             })
                  //         }
                  //       })
                  //       .catch(err => {
                  //         console.log(
                  //           err,
                  //           'error in inserting sectionb --------------------'
                  //         )
                  //         return reject({
                  //           status: 400,
                  //           message: 'Error in inserting sections.',
                  //           error: err
                  //         })
                  //       })
                  //   })









                  function addPrivilegesbackup (reqPrivileges, categoryObj) {
                    let preArray = []
                    return new Promise(function (resolve, reject) {
                      reqPrivileges.map((privilege, index) => {
                        let permissions = privilege.permissions
                        let users = privilege.users
                        let groups = privilege.groups
                        return createGroup(groups, permissions, users, categoryObj)
                          .then(response => {
                            preArray.push(response)
                            if (reqPrivileges.length === preArray.length) return resolve(response)
                          })
                          .catch(error => {
                            console.log('---------errorrrrrrrrr------------', error)
                            return reject({
                              status: 400,
                              message: error.message,
                              error: error
                            })
                          })
                      })
                    })
                  }
