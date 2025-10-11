import React, { useState } from 'react';
import { Document } from '../types';
import { TreeNode } from './TreeNode';

interface TreeProps {
  document: Document;
}

export function Tree({ document }: TreeProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  return (
    <div className="p-4">
      <TreeNode
        nodeId={document.rootNodeId}
        nodes={document.nodes}
        nodeTypeConfig={document.nodeTypeConfig || {}}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />
    </div>
  );
}
