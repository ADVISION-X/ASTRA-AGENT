import { Node, SyntaxKind, type Project } from "ts-morph";

type Finding = { code: string; detail: string; path: string };

export const inspectNodeHttpServer = (project: Project): Finding[] => project.getSourceFiles().flatMap((source) =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    const name = Node.isIdentifier(expression) ? expression.getSymbol()?.getName() ?? "" : Node.isPropertyAccessExpression(expression) ? expression.getName() : "";
    return name === "createServer" || name === "listen" ? [{ code: "AUDIT_HTTP_SERVER_FORBIDDEN", detail: name, path: source.getFilePath() }] : [];
  }));
