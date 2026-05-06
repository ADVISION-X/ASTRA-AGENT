# AI Input Schema Invalid Regression Mutation

Mutation: change the Orchestration-to-AI envelope builder from `taskType: input.taskType` back to `taskType: input.promptContractId`.

Expected result: the Orchestration owner inspector fails because AI dispatch would again transport the prompt contract id as the AI schema discriminant.
