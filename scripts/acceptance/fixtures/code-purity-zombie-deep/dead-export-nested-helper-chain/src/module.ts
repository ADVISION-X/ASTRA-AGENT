export const live = () => usedHelper();

export const deadExport = () => deadHelper();

const usedHelper = () => 1;
const deadHelper = () => deadLeaf();
const deadLeaf = () => 2;