const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios')
const {
  insertCategory,
  insertGroup,
  addPreviligesToCategory,
  addUserToGroup,
  deletePreviligesToCategory
} = require('./library')

const app = express()

app.use(bodyParser.urlencoded({ extended: false }))

app.use(bodyParser.json())

app.post('/api/create-forum', async function (req, res) {
  console.log(req.body)
  let { body } = req
  let groupData = []
  let deleteArr = []
  try {
    return insertCategory(req.body)
      .then(resData => {
        if (resData.status == 200) {
          let cid = resData.data.payload.cid
          let groupNameArr = [
            `moderator-${body.course_name}`,
            `general-${body.course_name}`
          ]
          groupNameArr.map((name, inx) => {
            return insertGroup(name)
              .then(groupRes => {
                let reqPreviligesData = null
                console.log(
                  '--------------- add /delete previliges --------------'
                )
                groupRes.data.payload.name.includes('general')
                  ? (reqPreviligesData = {
                      groups: [groupRes.data.payload.name],
                      privileges: [
                        'groups:topics:read',
                        'groups:read',
                        'groups:find',
                        'groups:topics:create',
                        'groups:topics:reply',
                        'groups:topics:tag',
                        'groups:posts:edit',
                        'groups:posts:upvote',
                        'groups:posts:downvote'
                      ]
                    })
                  : (reqPreviligesData = {
                      groups: [groupRes.data.payload.name],
                      privileges: [
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
                      ]
                    })
                return addPreviligesToCategory(reqPreviligesData, cid)
                  .then(prevRes => {
                    if (prevRes.code == 'ok') {
                      groupData.push(prevRes)
                      if (groupNameArr.length === groupData.length) {
                        let delgroupData = [
                          'registered-users',
                          'guests',
                          'spiders'
                        ]
                        let previligesArray = null
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
                          let data = {
                            groups: [name],
                            privileges: previligesArray
                          }
                          return deletePreviligesToCategory(data, cid)
                            .then(detRes => {
                              console.log(detRes, '>>>>>>>>>>>>>>>>>>>')
                              deleteArr.push(detRes)
                              if (deleteArr.length == delgroupData.length) {
                                body.moderators.map((uid, i) => {
                                  return addUserToGroup(groupNameArr[0], uid)
                                    .then(userRes => {
                                      console.log(
                                        '---------- user res -----------',
                                        userRes
                                      )
                                    })
                                    .catch(err => {
                                      console.log(
                                        'Error in adding user into gruop'
                                      )
                                      return err
                                    })
                                })
                              }
                            })
                            .catch(err => {
                              console.log(
                                '-----------Error in removing previliges to category----------',
                                err
                              )
                              return err
                            })
                        })
                      }
                    }
                  })
                  .catch(err => {
                    console.log('Error in adding previliges to category', err)
                    return err
                  })
                // }
              })
              .catch(err => {
                console.log('Error in inserting group------------', err)
                return err
              })
          })
        }
      })
      .catch(err => {
        console.log('Error in inserting category------------', err)
        return err
      })
  } catch (err) {
    console.log(err, '0000000000000000000')
    return err
  }
})

app.listen(3000, () => console.log('Webhook server is listening, port 3000'))
