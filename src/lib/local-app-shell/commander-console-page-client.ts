export const commanderConsolePageClient = `
const commanderConsoleShell = {
  async issueCommand(path, body = {}) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(await response.text() || response.statusText);
    }
    location.reload();
  },
  async markCandidate(candidateId, disposition) {
    const response = await fetch("/api/candidates/" + candidateId + "/disposition", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ disposition }),
    });
    if (!response.ok) {
      throw new Error(await response.text() || response.statusText);
    }
    location.reload();
  },
  async deleteCandidate(candidateId) {
    const response = await fetch("/api/candidates/" + candidateId, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(await response.text() || response.statusText);
    }
    location.reload();
  },
};
window.commanderConsoleShell = commanderConsoleShell;
`;
