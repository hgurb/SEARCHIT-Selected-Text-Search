// Shared with the browser tests; classic scripts are required for content scripts.
globalThis.searchitPosition = function (rect, width, height, position, viewportWidth, viewportHeight) {
  const gap = 8;
  let x = rect.right - width;
  let y = rect.bottom + gap;
  if (position.endsWith('-left')) x = rect.left;
  if (position.endsWith('-center')) x = (rect.left + rect.right - width) / 2;
  if (position.startsWith('top-')) y = rect.top - height - gap;
  if (position === 'right' || position === 'left') {
    x = position === 'right' ? rect.right + gap : rect.left - width - gap;
    y = (rect.top + rect.bottom - height) / 2;
  }
  if (position.endsWith('-corner')) {
    x = position.includes('-right-') ? rect.right : rect.left - width;
    y = position.startsWith('top-') ? rect.top - height - 2 : rect.bottom + 2;
  }
  // Keep every icon reachable when the selected position is near a screen edge.
  return { x: Math.max(gap, Math.min(x, viewportWidth - width - gap)), y: Math.max(gap, Math.min(y, viewportHeight - height - gap)) };
};

globalThis.searchitRows = function (count, limit, available) {
  if (!count) return [];
  if (limit === 0) return [count];
  const maximum = Math.max(1, Math.min(limit, available));
  const rows = Math.ceil(count / maximum);
  const perRow = Math.floor(count / rows);
  const extra = count % rows;
  return Array.from({ length: rows }, (_, index) => perRow + (index < extra ? 1 : 0));
};
