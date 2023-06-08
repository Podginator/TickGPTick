const TickTickClient = require('./lib/TickTickClient')
const {
  expandTasksIntoAtomicTasks,
  expandDescriptionsForAiPrompt
} = require('./lib/OpenAI');
const { getExpandedNumberFromTags } = require('./lib/utils');

(async () => {
  const ticktickClient = await TickTickClient.createClient(
    process.env.TICKUSERNAME,
    process.env.TICKPASSWORD
  )

  const removeTags = async tasks => {
    const removeTagsPromises = []
    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index]
      removeTagsPromises.push(
        ticktickClient.removeTagsByPredicate(task, tag =>
          tag.includes('expand')
        )
      )
    }
    return Promise.all(removeTagsPromises)
  }

  const createSubTasks = async (savedtasks, newTasks) => {
    const addedSubtasksPromises = []
    for (let index = 0; index < savedtasks.length; index++) {
      const { projectId, ...parent } = savedtasks[index]
      const newTaskList = newTasks[index]
      addedSubtasksPromises.push(
        ticktickClient.addSubstacksToTask(parent, projectId, newTaskList)
      )
    }

    return Promise.all(addedSubtasksPromises)
  }

  const removeTagsAndAddSubTasks = async (tasks, newTasks) => {
    const savedTagless = await removeTags(tasks)
    await createSubTasks(savedTagless, newTasks)
  }

  const replaceDescriptionWithAi = async updates => {
    const aiPromptRegex = /(?<=ai\{\{)[^}]+(?=\}\})/g
    const tasksContainingAiPrompt = updates
      .flatMap(it => it.content.match(aiPromptRegex))
      .filter(it => it)

    if (tasksContainingAiPrompt.length > 0) {
      console.log(
        `Updating ${tasksContainingAiPrompt}'s description`
      )
      const aiResponses = await Promise.all(
        tasksContainingAiPrompt.map(expandDescriptionsForAiPrompt)
      )

      
      const updatedDescriptions = updates.map((task, index) => ({
        ...task,
        content: task.content.replace(/ai{{.*}}/g, aiResponses[index])
      }))

      return ticktickClient.updateTasks(updatedDescriptions)
    }
  }

  const handleTaskCreation = async updates => {
    const expandableUpdates = updates.filter(
      ({ tags }) => tags && tags.some(tag => tag.includes('expand'))
    )

    const newTasks = await Promise.all(
      expandableUpdates.map(it => {
        const maxNo = getExpandedNumberFromTags(it.tags)
        return expandTasksIntoAtomicTasks(it, maxNo)
      })
    )

    return removeTagsAndAddSubTasks(expandableUpdates, newTasks)
  }

  let lastChecked = Date.now()
  do {
    try { 
      const {
        checkPoint,
        syncTaskBean: { update }
      } = await ticktickClient.getUpdatesSince(lastChecked)
      lastChecked = checkPoint

      await handleTaskCreation(update)
      await replaceDescriptionWithAi(update)

      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (e) { 
      // This is terrible error handling, but it's a PoC right now.
      // We will skip over it next time due to the lastChecked parameter.
      console.error("Something went wrong", e)
    }
  } while (true)
})()
