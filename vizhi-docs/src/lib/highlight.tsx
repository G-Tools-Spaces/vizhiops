import Prism from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import type { ReactNode } from "react";

/**
 * Tiny Prism wrapper that returns React nodes (no dangerouslySetInnerHTML).
 * Token colours come from the `--syn-*` variables in globals.css, so the
 * highlighting follows the site's light/dark theme automatically.
 */

export type HighlightLanguage = "python" | "js" | "curl" | "json";

const GRAMMAR: Record<HighlightLanguage, string> = {
  python: "python",
  js: "javascript",
  curl: "bash",
  json: "json",
};

function renderToken(token: Prism.Token | string, key: number): ReactNode {
  if (typeof token === "string") return token;
  const content = Array.isArray(token.content)
    ? token.content.map((child, index) => renderToken(child, index))
    : typeof token.content === "string"
      ? token.content
      : renderToken(token.content as Prism.Token, 0);
  return (
    <span key={key} className={`token ${token.type}`}>
      {content}
    </span>
  );
}

export function highlight(code: string, language: HighlightLanguage): ReactNode {
  const grammar = Prism.languages[GRAMMAR[language]];
  if (!grammar) return code;
  return Prism.tokenize(code, grammar).map((token, index) => renderToken(token, index));
}
