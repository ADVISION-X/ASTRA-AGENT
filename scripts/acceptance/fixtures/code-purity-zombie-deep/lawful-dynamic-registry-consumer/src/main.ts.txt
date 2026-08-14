import { registry } from "./module.js";

const selectedKey = Math.random() > -1 ? "newFlow" : "oldFlow";

console.log(registry[selectedKey]());