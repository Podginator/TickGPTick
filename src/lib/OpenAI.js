const { Configuration, OpenAIApi } = require('openai')
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(configuration)

const expandTasksIntoAtomicTasks = async ({ title, content }, maxTasks = 5) => {
  const prompt = `[no prose]
    [output json format ["task1", "task2"]]
    [make exactly ${maxTasks} todo list steps breaking down "${title}" into simpler steps]
    [use "${content}" for clues about the steps]`

  const response = await openai.createCompletion({
    max_tokens: 256,
    model: 'text-davinci-003',
    prompt,
    temperature: 0
  })

  return JSON.parse(response.data.choices[0].text)
}

const expandDescriptionsForAiPrompt = async description => {
  const prompt = `[short response][non conversational] ${description}`

  const response = await openai.createCompletion({
    max_tokens: 256,
    model: 'text-davinci-003',
    prompt,
    temperature: 0
  })

  return response.data.choices[0].text.trimStart()
}

module.exports = { expandTasksIntoAtomicTasks, expandDescriptionsForAiPrompt }
