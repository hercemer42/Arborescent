const fs = require('fs');

const data = JSON.parse(fs.readFileSync('arbo/todo.json', 'utf8'));

const nodeIds = new Set(Object.keys(data.nodes));

for (const [nodeId, node] of Object.entries(data.nodes)) {
  if (node.children && node.children.length > 0) {
    const validChildren = [];
    const seen = new Set();

    for (const childId of node.children) {
      if (nodeIds.has(childId) && !seen.has(childId)) {
        validChildren.push(childId);
        seen.add(childId);
      }
    }

    node.children = validChildren;
  }
}

fs.writeFileSync('arbo/todo.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Cleaned up duplicates and dangling references');
