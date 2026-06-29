import React from "react";
import { DEFAULT_NOTE_COLOR, getHighlightHoverStyle, getHighlightStyle } from "../../utils/workspaceNotebookColors.js";
import { getHighlightRects, getRectStyle } from "../../utils/workspaceNotebookAnchor.js";

const baseClass = "pointer-events-auto absolute z-[1] rounded-[1px] border-0 transition";
const draftClass = "pointer-events-none absolute z-[1] rounded-[1px]";

export default function WorkspaceNotebookHighlightRects({
  anchor,
  color = DEFAULT_NOTE_COLOR,
  interactive = false,
  noteId,
  onHighlightClick,
}) {
  const rects = getHighlightRects(anchor);
  if (!rects.length) return null;

  const highlightStyle = getHighlightStyle(color);
  const hoverStyle = getHighlightHoverStyle(color);

  return rects.map((rect, index) => {
    const style = { ...getRectStyle(rect), ...highlightStyle };

    if (interactive) {
      return (
        <button
          className={`${baseClass} cursor-pointer`}
          data-workspace-note-highlight="true"
          key={`${noteId}-${index}`}
          onClick={(event) => {
            event.stopPropagation();
            onHighlightClick?.();
          }}
          onMouseEnter={(event) => {
            Object.assign(event.currentTarget.style, { ...style, ...hoverStyle });
          }}
          onMouseLeave={(event) => {
            Object.assign(event.currentTarget.style, style);
          }}
          style={style}
          title="Xem ghi chú"
          type="button"
        />
      );
    }

    return (
      <span
        aria-hidden="true"
        className={draftClass}
        key={`draft-${index}`}
        style={style}
      />
    );
  });
}
