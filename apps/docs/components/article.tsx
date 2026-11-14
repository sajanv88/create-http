import { ChevronDownIcon } from "@nuvui/icons";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  TableOfContents,
  type TableOfContentsItem,
} from "@nuvui/react";
import type { ReactNode } from "react";

interface ArticleProps {
  kicker: string;
  title: string;
  lead: ReactNode;
  /** The page's headings, in order. Each `id` must be a heading's id in `children`. */
  contents: TableOfContentsItem[];
  children: ReactNode;
}

// From nuvui's "Page with its contents" block: the text, and a list of its headings
// that marks the one being read. Beside the text on a wide screen, behind a button on a
// narrow one. Both lists get the same items, so they mark the same heading.
export function Article({ kicker, title, lead, contents, children }: ArticleProps) {
  return (
    <div className="article">
      <article className="article__main">
        <header className="article__head">
          <p className="article__kicker">{kicker}</p>
          <h1 className="article__title">{title}</h1>
          <p className="article__lead">{lead}</p>
        </header>

        <Collapsible className="article__drawer">
          <CollapsibleTrigger asChild>
            <Button intent="secondary" className="article__toggle">
              On this page
              <ChevronDownIcon size={16} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <TableOfContents
              aria-label="On this page"
              items={contents}
              offset={112}
              className="article__contents"
            />
          </CollapsibleContent>
        </Collapsible>

        {children}
      </article>

      <aside className="article__side">
        <p className="article__label" id="article-contents">
          On this page
        </p>
        <TableOfContents aria-labelledby="article-contents" items={contents} offset={112} />
      </aside>
    </div>
  );
}

interface SectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

/** A top-level section: an h2 with its id, for the contents list. */
export function Section({ id, title, children }: SectionProps) {
  return (
    <section className="article__section" aria-labelledby={id}>
      <h2 id={id} className="article__heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A heading inside a section. */
export function Subheading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="article__subheading">
      {children}
    </h3>
  );
}
