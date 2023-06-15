const { Configuration, OpenAIApi } = require('openai')
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(configuration)

const DESCRIPTION_TEMPLATES = ["Use {} to create some context for subsequent tasks", "parent task was titled {}"];

const extractParentInformationOrReturnDescription = async (content) => { 
  const regex = /description:?(.*)parent_title:?(.+)|(.*)/gms;
  let m;
  
  const set = new Set();
  while ((m = regex.exec(content)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
          regex.lastIndex++;
      }
      
      // The result can be accessed through the `m`-variable.
      m.forEach((match) => {
          set.add(match)
      });
    }

    const arrSet = set.size > 1 ? [...set].slice(1).filter(it => it) : [...set].filter(it => it).slice(0, 1);
    
    return arrSet.map((it, idx) => DESCRIPTION_TEMPLATES[idx].replace("{}", it));
}

const expandTasksIntoAtomicTasks = async ({ title, content }, maxTasks = 5) => {
  const additionalContextClues = (await extractParentInformationOrReturnDescription(content)).map(content => ({ role: "user", content }));
  console.log(additionalContextClues);
  
  const response = await openai.createChatCompletion({
      model:"gpt-3.5-turbo-0613",
      messages: [{ role: "user", content: `make exactly ${maxTasks} todo list steps simplifying task "${title}" into smaller tasks` }, ...additionalContextClues], //
      functions: [ 
        { 
          name: "createSmallerTasks",
          description: "Takes a task, and turns it into smaller (micro) and more easily managable steps.",
          parameters: { 
            type: "object", 
            properties: {
              tasks: { 
                type: "object",
                description: "The smaller atomic tasks",
                properties: { 
                  "description": {
                    type: "string", 
                    description: "Some suggestions of how to achieve it"
                  },
                  "title": { 
                    type: "string", 
                    description: "The title of the task, summarising what to do"
                  }
                }
              }
            }
          }
        }

      ],
      function_call: "auto"
    });

  const res = response.data.choices[0]?.message ?? {};

  if (res['function_call']) { 
    const { tasks } = JSON.parse(res['function_call'].arguments)

    return tasks; 
  }

  return [];
}

const expandDescriptionsForAiPrompt = async description => {
  const prompt = `[short response][non conversational] ${description}`

  const response = await openai.createChatCompletion({
    max_tokens: 256,
    model: 'text-davinci-003',
    prompt,
    temperature: 0
  })

  return response.data.choices[0].text.trimStart()
}

module.exports = { expandTasksIntoAtomicTasks, expandDescriptionsForAiPrompt }
