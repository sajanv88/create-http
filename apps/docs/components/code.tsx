"use client";

import { CodeBlock } from "@nuvui/chat";
import { createShikiHighlighter } from "@nuvui/chat/shiki";

// One highlighter for the whole site, made outside any component. Shiki itself is only
// fetched the first time code is colored, so it isn't in the first page load.
const highlighter = createShikiHighlighter();

interface CodeProps {
  code: string;
  /** As written after a markdown fence: "ts", "sh". Shown over the code. */
  language: string;
  /** Shown in place of the language, usually a file name. */
  title?: string;
}

export function Code({ code, language, title }: CodeProps) {
  return (
    <CodeBlock
      code={code.trim()}
      language={language}
      title={title}
      highlighter={highlighter}
      className="code"
    />
  );
}
