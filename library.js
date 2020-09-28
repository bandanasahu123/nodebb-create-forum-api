var Categories = require.main.require('./src/categories')
var Groups = require.main.require('./src/groups')
var db = require.main.require('./src/database')
var Users = require.main.require('./src/user')
var async = require('async')
var _ = require('lodash')

function createCategory (body) {
  const tenantId = body.organisationId
  const sections = body.sections
  console.log('-------sections length----------', typeof sections, sections)
  let sectionArray = [],
    sectionObj = {},
    mappingTenant = null,
    existedCatId = null,
    existedCatName = null
  return new Promise(function (resolve, reject) {
    db.getObject(`tenant_cat_map:` + tenantId)
      .then(tenentObj => {
        console.log(tenentObj, '----------------------------')
        if (tenentObj) {
          existedCatId = tenentObj.tenant_id
          existedCatName = tenentObj.name
        }
        let pID = tenentObj && tenentObj.cat_id ? tenentObj.cat_id : ''

        if (existedCatId == tenantId) {
          return reject({
            status: 400,
            message: 'Already category id exist for this tenant!'
          })
        } else {
          const reqData = {
            name: body.name,
            parentCid: pID,
            isSection: 1
          }
          Categories.create(reqData)
            .then(categoryObj => {
              if (!pID) {
                if (sections.length > 0) {
                  return commonAddSection(
                    body.name,
                    sections,
                    categoryObj.cid,
                    tenantId
                  )
                    .then(res => {
                      let response = {
                        categoryObj: categoryObj,
                        sectionObj: res
                      }
                      return resolve(response)
                    })
                    .catch(error => {
                      return reject(error)
                    })
                } else {
                  let jsonTenanatObj = {
                    cat_id: categoryObj.cid,
                    tenant_id: tenantId,
                    name: body.name
                  }

                  mappingTenant = mappingFunction(
                    `tenant_cat_map:${tenantId}`,
                    jsonTenanatObj
                  )

                  Promise.all([mappingTenant])
                    .then(responnse => {
                      let response = {
                        categoryObj: categoryObj,
                        sectionObj: []
                      }
                      return resolve(response)
                    })
                    .catch(err => {
                      return reject({
                        status: 400,
                        message: 'Error in mapping data.',
                        error: err
                      })
                    })
                }
              } else {
                return resolve(categoryObj)
              }
            })
            .catch(err => {
              console.log('>>>>>>>> err in inserting category >>>', err)
              return reject({
                status: 400,
                message: 'Error in inserting category',
                error: err
              })
            })
        }
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

function commonAddSection (cname, sections, cid, tenantId) {
  let sectionArray = [],
    sectionObj = {}
  return new Promise(function (resolve, reject) {
    if (sections.length > 0) {
      sections.map((secName, inx) => {
        let name = secName.replace(/\s+/g, '-').toLowerCase()
        const bodyData = {
          name: secName,
          parentCid: cid
        }
        Categories.create(bodyData)
          .then(catData => {
            sectionArray.push(catData)
            sectionObj[name] = catData.cid
            if (sections.length === sectionArray.length) {
              let jsonTenanatObj = {
                ...sectionObj,
                cat_id: cid,
                tenant_id: tenantId,
                name: cname
              }

              mappingTenant = mappingFunction(
                `tenant_cat_map:${tenantId}`,
                jsonTenanatObj
              )

              Promise.all([mappingTenant])
                .then(responnse => {
                  //   let response = {
                  //     categoryObj: categoryObj,
                  //     sectionObj: sectionArray
                  //   }
                  return resolve(sectionArray)
                })
                .catch(err => {
                  return reject({
                    status: 400,
                    message: 'Error in mapping data.',
                    error: err
                  })
                })
            }
          })
          .catch(err => {
            console.log(err, 'error in inserting sectionb --------------------')
            return reject({
              status: 400,
              message: 'Error in inserting sections.',
              error: err
            })
          })
      })
    }
  })
}

function addSection (body) {
  const tenantId = body.organisationId
  const sections = body.sections
  let sectionArray = [],
    sectionObj = {}
  return new Promise(function (resolve, reject) {
    db.getObject(`tenant_cat_map:` + tenantId)
      .then(tenentObj => {
        console.log(tenentObj, '----------------------------')
        let pID = tenentObj && tenentObj.cat_id ? tenentObj.cat_id : ''

        if (sections.length > 0) {
          return commonAddSection(tenentObj.name, sections, pID, tenantId)
            .then(res => {
              let response = {
                sectionObj: res
              }
              return resolve(response)
            })
            .catch(error => {
              return reject(error)
            })
        }
      })
      .catch(error => {
        console.log('>>>>>>> find tenent id error <<<<<<<<', err)
        return reject({
          status: 400,
          message: 'Error in finding tenant id',
          error: err
        })
      })
  })
}

async function mappingFunction (key, obj) {
  try {
    let mappingRes = await db.setObject(key, obj)
    return mappingRes
  } catch (err) {
    return err
  }
}

function addPrivileges (reqPrivileges, categoryObj) {
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

function createGroup (groups, permissions, users, catIds) {
  return new Promise(function (resolve, reject) {
    groups.map((group, inx) => {
      Groups.create({ name: group })
        .then(groupObj => {
          if (groupObj) {
            return addGroupIntoCategory(group, permissions, catIds)
              .then(res => {
                return removeuserPreviliges(catIds)
                  .then(res => {
                    return addUserIntoGroup(group, users, permissions, catIds)
                      .then(res => {
                        resolve(res)
                      })
                      .catch(error => {
                        return reject({
                          status: 400,
                          message: 'Error in adding users into category',
                          error: error
                        })
                      })
                  })
                  .catch(error => {
                    return reject({
                      status: 400,
                      message: 'Error in removing privileges into category',
                      error: error
                    })
                  })
              })
              .catch(error => {
                return reject({
                  status: 400,
                  message: 'Error in adding group into category',
                  error: error
                })
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

async function addGroupIntoCategory (group, permissions, catIds) {
  console.log('------------ addGroupIntoCatrgory catIds ---------', catIds)
  return new Promise(function (resolve, reject) {
    let groups = [group]
    let finalPrivileges = null
    permissions.map((permission, inx) => {
      finalPrivileges = privilegesHirerchy(permission, 'group')
    })
    finalPrivileges = _.uniq(finalPrivileges)
    console.log(finalPrivileges, '----------------finalPrivileges----')

    catIds.map(id => {
      changeGroupMembership(id, finalPrivileges, groups, 'join')
        .then(data => {
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
  })
}

async function addUserIntoGroup (groupName, users, permissions, catIds) {
  console.log('------coming addUserIntoGroup--------------- ', users)
  return new Promise(function (resolve, reject) {
    if (users && users.length > 0) {
      users.map(sunbirdAuthId => {
        return getUserIdFromOauthId(sunbirdAuthId).then(uid => {
          if (uid) {
            Groups.join(groupName, uid)
              .then(data => {
                return addUserPreviliges(uid, permissions, catIds)
                  .then(res => {
                    return resolve(res)
                  })
                  .catch(err => {
                    return reject({
                      status: 400,
                      message: 'Error in adding user previliges',
                      error: err
                    })
                  })
              })
              .catch(err => {
                return reject({
                  status: 400,
                  message: 'Error in joining',
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
      return resolve(true)
    }
  })
}

function addUserPreviliges (uid, permissions, catIds) {
  return new Promise(function (resolve, reject) {
    let groups = [uid]

    let finalPrivileges = null
    permissions.map((permission, inx) => {
      finalPrivileges = privilegesHirerchy(permission, 'user')
    })
    finalPrivileges = _.uniq(finalPrivileges)
    console.log(finalPrivileges, '----------------finalPrivileges----')

    catIds.map(id => {
      changeGroupMembership(id, finalPrivileges, groups, 'join')
        .then(data => {
          return resolve(data)
        })
        .catch(err => {
          return reject({
            status: 400,
            message: 'Error in adding users previliges into category',
            error: err
          })
        })
    })
  })
}

function removeuserPreviliges (catIds) {
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
      catIds.map(id => {
        changeGroupMembership(id, previligesArray, name, 'leave')
          .then(data => {
            arr.push(data)
            if (delgroupData.length === arr.length) {
              return resolve(arr)
            }
          })
          .catch(err => {
            return res.json({
              status: 400,
              message: 'Error in removing priviliges',
              error: err
            })
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

async function getUserIdFromOauthId (sunbirdId) {
  let uid = await db.getObjectField('sunbird-oidcId:uid', sunbirdId)
  return uid
}

function privilegesHirerchy (privilegs, type) {
  console.log('--------------privilegs-----------', privilegs)
  let readPriviliges =
    type === 'user'
      ? ['topics:read', 'read', 'find']
      : ['groups:topics:read', 'groups:read', 'groups:find']
  let votePriviliges =
    type === 'user'
      ? ['posts:upvote', 'posts:downvote']
      : ['groups:posts:upvote', 'groups:posts:downvote']
  let postPriviliges =
    type === 'user'
      ? ['topics:reply', 'posts:edit', 'posts:delete']
      : ['groups:topics:reply', 'groups:posts:edit', 'groups:posts:delete']
  let topicPriviliges =
    type === 'user'
      ? ['topics:create', 'topics:tag']
      : ['groups:topics:create', 'groups:topics:tag']
  let moderatorPriviliges =
    type === 'user'
      ? [
          'topics:delete',
          'posts:view_deleted',
          'purge',
          'moderate',
          'posts:history'
        ]
      : [
          'groups:topics:delete',
          'groups:posts:view_deleted',
          'groups:purge',
          'groups:moderate',
          'groups:posts:history'
        ]

  let givenPrivileges = null
  switch (privilegs) {
    case 'read':
      givenPrivileges = readPriviliges
      break
    case 'vote':
      givenPrivileges = [...readPriviliges, ...votePriviliges]
      break
    case 'post':
      givenPrivileges = [
        ...readPriviliges,
        ...votePriviliges,
        ...postPriviliges
      ]
      break
    case 'topic':
      givenPrivileges = [
        ...readPriviliges,
        ...votePriviliges,
        ...postPriviliges,
        ...topicPriviliges
      ]
      break
    case 'moderate':
      givenPrivileges = [
        ...readPriviliges,
        ...votePriviliges,
        ...postPriviliges,
        ...topicPriviliges,
        ...moderatorPriviliges
      ]
      break
  }
  console.log('------------givenPrivileges-------------', givenPrivileges)
  return givenPrivileges
}

module.exports = {
  createCategory,
  addPrivileges,
  addSection
}
