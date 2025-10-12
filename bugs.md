# Known Bugs

## High Priority

## Medium Priority

## Low Priority

### Cursor positioning when clicking on padding
When clicking on the vertical padding area (top/bottom borders) of a content box, the cursor defaults to the start or end of the content rather than intelligently positioning based on click coordinates. This is due to standard contentEditable behavior where clicks on empty space (no text) default to the nearest edge.
