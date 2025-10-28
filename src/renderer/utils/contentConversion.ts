export function convertFromContentEditable(element: HTMLElement): string {
  if (typeof element.cloneNode !== 'function') {
    return element.textContent || '';
  }
  const clone = element.cloneNode(true) as HTMLElement;
  const brElements = clone.querySelectorAll('br');
  brElements.forEach(br => {
    br.replaceWith('\n');
  });
  const divElements = clone.querySelectorAll('div');
  divElements.forEach((div, index) => {
    if (index > 0) {
      div.prepend(document.createTextNode('\n'));
    }
  });
  return clone.textContent || '';
}

export function convertToContentEditable(element: HTMLElement, content: string): void {
  if (typeof element.appendChild !== 'function') {
    element.textContent = content;
    return;
  }
  const lines = content.split('\n');
  element.innerHTML = '';
  lines.forEach((line, index) => {
    element.appendChild(document.createTextNode(line));
    if (index < lines.length - 1) {
      element.appendChild(document.createElement('br'));
    }
  });
}
