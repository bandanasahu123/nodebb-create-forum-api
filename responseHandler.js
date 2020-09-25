'use strict'
var _ = require('lodash')
const { v4: uuidv4 } = require('uuid')

module.exports = {
  successResponse: resObj => {
    return {
      id: resObj.id,
      ver: '1.0',
      ets: Date.now(),
      params: {
        resmsgid: uuidv4(),
        msgid: resObj.msgId ? resObj.msgId : '',
        status: resObj.status
      },
      responseCode: resObj.resCode,
      result: resObj.data
    }
  },
  errorResponse: resObj => {
    return {
      id: resObj.id,
      ver: '1.0',
      ets: Date.now(),
      params: {
        resmsgid: uuidv4(),
        msgid: resObj.msgId ? resObj.msgId : '',
        status: resObj.status,
        err: resObj.err ? resObj.err : '',
        errmsg: resObj.errmsg ? resObj.errmsg : ''
      },
      responseCode: resObj.resCode,
      result: {}
    }
  }
}
