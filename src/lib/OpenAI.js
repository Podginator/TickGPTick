const { OpenAI } = require('openai')
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const DESCRIPTION_TEMPLATES = ["Use {} to create some context for subsequent tasks", "parent task was titled {}"];

const extractParentInformationOrReturnDescription = async (content) => { 
  const regex = /description:?(.*)parent_title:?(.+)|(.*)/gms;
  let matches;
  
  const set = new Set();
  while ((matches = regex.exec(content)) !== null) {
      if (matches.index === regex.lastIndex) {
          regex.lastIndex++;
      }      

      matches.forEach(it => set.add(it))
    }

    const arrSet = set.size > 1 ? [...set].slice(1).filter(it => it) : [...set].filter(it => it).slice(0, 1);

    return arrSet.map((it, idx) => DESCRIPTION_TEMPLATES[idx].replace("{}", it));
}

const expandTasksIntoAtomicTasks = async ({ title, content }, maxTasks = 5) => {
  const additionalContextClues = (await extractParentInformationOrReturnDescription(content)).map(content => ({ role: "user", content }));
  const messages = [{ role: "user", content: `make exactly ${maxTasks} todo list steps simplifying task "${title}" into smaller tasks` }, ...additionalContextClues]
  
  console.log(`Calling OpenAI with steps ${JSON.stringify(messages)}`)

  const response = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages,
      functions: [ 
        { 
          name: "createSmallerTasks",
          description: "Takes a task, and turns it into smaller (micro) and more easily managable steps.",
          parameters: { 
            type: "object", 
            properties: {
              tasks: { 
                type: "array",
                items: { 
                  type: "object",
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
                },
                description: "The array of smaller atomic tasks",
              }
            }
          }
        }
      ],
      function_call: "auto"
    });

  const res = response.choices[0]?.message ?? {};

  if (res['function_call']) { 
    console.log(JSON.parse(res['function_call'].arguments))
    const { tasks } = JSON.parse(res['function_call'].arguments)
    console.log(tasks);
    return tasks; 
  }

  return [];
}

const expandDescriptionsForAiPrompt = async description => {
  const prompt = `[short response][non conversational] ${description}`

  const response = await openai.chat.completions.create({
    max_tokens: 256,
    model:"gpt-4o-mini",
    messages: [{ role: 'user', content: prompt }],
    temperature: 0
  })

  return response.choices[0].message.content.trimStart()
}

module.exports = { expandTasksIntoAtomicTasks, expandDescriptionsForAiPrompt }
