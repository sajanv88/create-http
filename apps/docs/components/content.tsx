import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nuvui/react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@nuvui/table/table";
import type { ReactNode } from "react";
import { Code } from "./code";

/** Code inside a sentence. Blocks of code are `Code`. */
export function C({ children }: { children: ReactNode }) {
  return <code className="inline-code">{children}</code>;
}

interface DataTableProps {
  /** Read out as the table's name by screen readers. */
  caption: string;
  head: string[];
  rows: ReactNode[][];
}

/** A plain table of options or values. The first cell of each row is its heading. */
export function DataTable({ caption, head, rows }: DataTableProps) {
  return (
    <TableContainer className="data-table">
      <Table aria-label={caption}>
        <TableHeader>
          <TableRow>
            {head.map((label) => (
              <TableHead key={label}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, r) => (
            // Rows are static content, written once; their order never changes.
            // biome-ignore lint/suspicious/noArrayIndexKey: static rows that never reorder
            <TableRow key={r}>
              {row.map((cell, c) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static cells that never reorder
                <TableCell key={c} rowHeader={c === 0}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const managers = [
  { id: "npm", command: "npm install" },
  { id: "pnpm", command: "pnpm add" },
  { id: "yarn", command: "yarn add" },
  { id: "bun", command: "bun add" },
] as const;

/** The install command for each package manager, one tab each. */
export function InstallTabs({ packageName }: { packageName: string }) {
  return (
    <Tabs defaultValue="npm" className="install-tabs">
      <TabsList aria-label="Package manager">
        {managers.map((m) => (
          <TabsTrigger key={m.id} value={m.id}>
            {m.id}
          </TabsTrigger>
        ))}
      </TabsList>
      {managers.map((m) => (
        <TabsContent key={m.id} value={m.id}>
          <Code code={`${m.command} ${packageName}`} language="sh" title="Terminal" />
        </TabsContent>
      ))}
    </Tabs>
  );
}
