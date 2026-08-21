export const actionResult = (browserActionId: string) => ({
  browserActionId,
  ok: true,
  message: "ok",
  createdAt: new Date().toISOString(),
});

export const readExpectedAttachmentNames = (script: string): string[] => {
  const match = script.match(/const expectedFileNames = (\[[^\n]+\]);/u);
  return match ? JSON.parse(match[1]!) as string[] : [];
};

export const readExpectedPageUrl = (script: string): string | null => {
  const match = script.match(/const expectedPageUrl = (null|"[^"\n]*");/u);
  return match ? JSON.parse(match[1]!) as string | null : null;
};

