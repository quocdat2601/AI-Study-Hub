export function tagsToInput(tags) {
  return (tags || []).map((tag) => tag.name).join(", ");
}
