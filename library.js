const axios = require('axios')

const options = {
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer e46abd4f-040f-44df-8b33-4c4b89ed45a0'
  }
}

function insertCategory (body) {
  return new Promise(function (resolve, reject) {
    const reqData = {
      name: `${body.course_name}(${body.batch_start_date} - ${body.batch_end_date})`,
      parentCid: body.parentCid || ''
    }
    axios
      .post('http://localhost:4567/api/v2/categories', reqData, options)
      .then(res => {
        console.log('RESPONSE ==== : ', res.data)
        let resObj = {
          status: res.status,
          data: res.data
        }
        return resolve(resObj)
      })
      .catch(err => {
        console.log('ERROR: ====', err)
        return reject(err)
      })
  })
}

function insertGroup (name) {
  return new Promise(function (resolve, reject) {
    const reqGroupData = {
      name: name,
      private: 1
    }
    axios
      .post('http://localhost:4567/api/v2/groups', reqGroupData, options)
      .then(res => {
        console.log('RESPONSE ==== : ', res.data)
        let resObj = {
          status: res.status,
          data: res.data
        }
        return resolve(resObj)
      })
      .catch(err => {
        console.log('ERROR: ====', err)
        return reject(err)
      })
  })
}

function addUserToGroup (groupName, uid) {
  return new Promise(function (resolve, reject) {
    axios
      .put(
        `http://localhost:4567/api/v2/groups/${groupName}/membership/${uid}`,
        {},
        options
      )
      .then(res => {
        console.log('RESPONSE ==== : ', res.data)
        let resObj = {
          status: res.status,
          data: res.data
        }
        return resolve(resObj)
      })
      .catch(err => {
        console.log('ERROR: ====', err)
        return reject(err)
      })
  })
}

function addPreviligesToCategory (reqPreviligesData, cid) {
  return new Promise(function (resolve, reject) {
    axios
      .put(
        `http://localhost:4567/api/v2/categories/${cid}/privileges`,
        reqPreviligesData,
        options
      )
      .then(res => {
        console.log(
          'RESPONSE ====addPreviligesToCategory========= : ',
          res.data
        )
        return resolve(res.data)
      })
      .catch(err => {
        return reject(err)
      })
  })
}

function deletePreviligesToCategory (data, cid) {
  let config = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: options.headers.Authorization
    },
    data: data
  }
  console.log('configggggggggggg', config)
  return new Promise(function (resolve, reject) {
    axios
      .delete(
        `http://localhost:4567/api/v2/categories/${cid}/privileges`,
        config
      )
      .then(res => {
        console.log('RESPONSE ====????????? : ', res.data)
        return resolve(res.data)
      })
      .catch(err => {
        return reject(err)
      })
  })
}

module.exports = {
  insertCategory,
  insertGroup,
  addPreviligesToCategory,
  addUserToGroup,
  deletePreviligesToCategory
}
