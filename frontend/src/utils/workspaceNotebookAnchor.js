const LINE_MERGE_THRESHOLD = 4;

function isValidRect(rect) {
  return rect && (rect.widthRatio > 0 || rect.width > 0) && (rect.heightRatio > 0 || rect.height > 0);
}

function mergeClientRectsByLine(clientRects) {
  const sorted = [...clientRects]
    .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const lines = [];

  for (const rect of sorted) {
    const existing = lines.find((line) => Math.abs(line.top - rect.top) <= LINE_MERGE_THRESHOLD);
    if (existing) {
      const right = Math.max(existing.left + existing.width, rect.left + rect.width);
      const bottom = Math.max(existing.top + existing.height, rect.top + rect.height);
      existing.left = Math.min(existing.left, rect.left);
      existing.top = Math.min(existing.top, rect.top);
      existing.width = right - existing.left;
      existing.height = bottom - existing.top;
    } else {
      lines.push({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }
  }

  return lines;
}

function buildRectFromDomRect(rect, scopeRect, containerRect) {
  if (!rect.width || !rect.height || !scopeRect.width || !scopeRect.height) return null;

  return {
    topRatio: (rect.top - scopeRect.top) / scopeRect.height,
    leftRatio: (rect.left - scopeRect.left) / scopeRect.width,
    widthRatio: rect.width / scopeRect.width,
    heightRatio: rect.height / scopeRect.height,
    containerTop: rect.top - containerRect.top,
    containerLeft: rect.left - containerRect.left,
    width: rect.width,
    height: rect.height,
  };
}

function legacyAnchorToRects(anchor = {}) {
  if (Number.isFinite(anchor.pageTopRatio)) {
    return [{
      topRatio: anchor.pageTopRatio,
      leftRatio: anchor.pageLeftRatio,
      widthRatio: anchor.widthRatio,
      heightRatio: anchor.heightRatio,
    }];
  }

  if (Number.isFinite(anchor.containerTopRatio)) {
    return [{
      topRatio: anchor.containerTopRatio,
      leftRatio: anchor.containerLeftRatio,
      widthRatio: anchor.widthRatio,
      heightRatio: anchor.heightRatio,
    }];
  }

  if (Number.isFinite(anchor.pageTop) || Number.isFinite(anchor.containerTop)) {
    return [{
      top: anchor.pageTop ?? anchor.containerTop ?? 0,
      left: anchor.pageLeft ?? anchor.containerLeft ?? 0,
      width: anchor.width ?? 4,
      height: anchor.height ?? 14,
    }];
  }

  return [];
}

export function getPdfPageScopeElement(fromNode) {
  const element = fromNode?.nodeType === Node.TEXT_NODE ? fromNode.parentElement : fromNode;
  return element?.closest?.(".react-pdf__Page") || element?.closest?.("[data-workspace-pdf-page]") || null;
}

export function getHighlightRects(anchor = {}) {
  if (Array.isArray(anchor.rects) && anchor.rects.length) {
    return anchor.rects.filter(isValidRect);
  }
  return legacyAnchorToRects(anchor);
}

export function buildAnchorFromRange(range, container) {
  const rawRects = Array.from(range.getClientRects());
  const clientRects = mergeClientRectsByLine(rawRects);
  const containerRect = container.getBoundingClientRect();
  const anchorNode = range.commonAncestorContainer;
  const element = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
  const pdfPageElement = getPdfPageScopeElement(element);
  const articleElement = element?.closest?.("[data-workspace-note-article]");
  const scopeElement = pdfPageElement || articleElement || container;
  const scope = pdfPageElement ? "page" : "container";
  const scopeRect = scopeElement.getBoundingClientRect();

  const rects = clientRects
    .map((rect) => buildRectFromDomRect(rect, scopeRect, containerRect))
    .filter(Boolean);

  return { scope, rects };
}

export function getRectStyle(rect) {
  if (Number.isFinite(rect.topRatio)) {
    return {
      position: "absolute",
      top: `${rect.topRatio * 100}%`,
      left: `${rect.leftRatio * 100}%`,
      width: `${Math.max(rect.widthRatio, 0.001) * 100}%`,
      height: `${Math.max(rect.heightRatio, 0.001) * 100}%`,
    };
  }

  return {
    position: "absolute",
    top: rect.top ?? 0,
    left: rect.left ?? 0,
    width: Math.max(rect.width ?? 2, 2),
    height: Math.max(rect.height ?? 12, 12),
  };
}

export function getNoteCardPosition(note, cardWidth = 300, containerWidth = 680) {
  const rects = getHighlightRects(note?.anchor);
  const first = rects[0];
  if (!first) return { cardTop: 0, cardLeft: 0 };

  const top = first.containerTop ?? 0;
  const besideLeft = (first.containerLeft ?? 0) + Math.max(first.width ?? 40, 40) + 16;
  const rightGutter = Math.max(12, containerWidth - cardWidth - 16);

  return {
    cardTop: top,
    cardLeft: besideLeft + cardWidth > containerWidth - 12 ? rightGutter : besideLeft,
  };
}

export function getDraftCardPosition(anchor, cardWidth = 300, containerWidth = 680) {
  return getNoteCardPosition({ anchor }, cardWidth, containerWidth);
}
