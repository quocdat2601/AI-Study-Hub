import { createContext, useContext } from "react";

export const WorkspaceNotebookContext = createContext({
  notes: [],
  viewMode: "text",
  draft: null,
  onHighlightClick: () => {},
});

export function useWorkspaceNotebook() {
  return useContext(WorkspaceNotebookContext);
}
