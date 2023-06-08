const axios = require('axios')
const { filter } = require('lodash')

class TickTickClient {
  constructor (tickTickInstance) {
    this.ticktickInstance = tickTickInstance
  }

  // There is no token based API for TickTick unfortunately. There is Oauth now, but I like this interface fine.
  // I have to fake a cookie based on a typical user/password login.
  static async createClient (username, password) {
    const tickTickInstance = axios.create({
      baseURL: 'https://api.ticktick.com/api/v2'
    })

    tickTickInstance.defaults.headers.common['x-device'] = JSON.stringify({device: 'TickGPTick'})

    const { token } = await tickTickInstance
      .post('/user/signon?wc=true&remember=true', { username, password })
      .then(({ data }) => data)

    tickTickInstance.defaults.headers.common['Cookie'] = `t=${token};`
    return new TickTickClient(tickTickInstance)
  }

  getUpdatesSince (dateTime) {
    return this.ticktickInstance
      .get(`/batch/check/${dateTime}`)
      .then(({ data }) => data)
  }
  updateTasks (tasks) {
    const payload = { update: tasks }
    return this.ticktickInstance.post('/batch/task', payload)
  }

  updateTask (task) {
    return this.updateTasks([task])
  }

  async removeTags (task, tagsToRemove) {
    const newTags = filter(task.tags, el => tagsToRemove.indexOf(el) !== -1)
    const modifiedTask = { ...task, tags: newTags }
    const updatePayload = { update: [modifiedTask] }
    return this.ticktickInstance
      .post('/batch/task', updatePayload)
      .then(_it => modifiedTask)
  }

  async removeTagsByPredicate (task, tagsPredicate) {
    const tagsToRemove = task.tags.filter(it => !tagsPredicate(it))
    return this.removeTags(task, tagsToRemove)
  }

  async addSubstacksToTask (parent, projectId, substacks) {
    const addingDate = new Date().toISOString()

    const substackUpdates = substacks.map(title => ({
      title,
      startDate: addingDate,
      modifiedDate: addingDate,
      projectId,
      parentId: parent.id,
      content: `step created from '${parent.title}' do not repeat`
    }))
    const payload = { add: substackUpdates }

    const addedTasks = await this.ticktickInstance
      .post('/batch/task', payload)
      .then(({ data }) => Object.keys(data['id2etag']))

    const newlyAddedIds = addedTasks.map(taskId => ({
      taskId,
      parentId: parent.id,
      projectId
    }))

    return this.ticktickInstance
      .post('/batch/taskParent', newlyAddedIds)
      .then(({ data }) => data)
  }
}

module.exports = TickTickClient
