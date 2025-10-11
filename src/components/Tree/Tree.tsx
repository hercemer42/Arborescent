import { useState } from 'react';
import { Document, NodeStatus } from '../../types';
import { Node } from '../Node/Node';
import './Tree.css';

interface TreeProps {
  document: Document;
}

export function Tree({ document }: TreeProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState(document.nodes);

  const handleStatusChange = (nodeId: string, status: NodeStatus) => {
    setNodes((prevNodes) => ({
      ...prevNodes,
      [nodeId]: {
        ...prevNodes[nodeId],
        metadata: {
          ...prevNodes[nodeId].metadata,
          status,
        },
      },
    }));
  };

  return (
    <div className="tree">
      <Node
        nodeId={document.rootNodeId}
        nodes={nodes}
        nodeTypeConfig={document.nodeTypeConfig || {}}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
