export const live = () => usedHelper();

const usedHelper = () => 1;
const deadRoot = () => deadHelper();
const deadHelper = () => deadLeaf();
const deadLeaf = () => 2;