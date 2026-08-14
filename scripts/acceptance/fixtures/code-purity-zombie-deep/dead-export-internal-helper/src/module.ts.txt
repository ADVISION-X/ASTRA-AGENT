export const live = () => usedHelper();

export const deadExport = () => deadHelper();

const usedHelper = () => 1;
const deadHelper = () => 2;