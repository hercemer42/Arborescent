import { useState } from 'react';
import { Document } from '../../types';
import { Node } from '../Node/Node';
import { styles } from './Tree.styles';

interface TreeProps {
  document: Document;
}

export function Tree({ document }: TreeProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  return (
    <div className={styles.container}>
      <Node
        nodeId={document.rootNodeId}
        nodes={document.nodes}
        nodeTypeConfig={document.nodeTypeConfig || {}}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />
    </div>
  );
}
