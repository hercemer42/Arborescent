import { useState } from 'react';
import { Document, NodeStatus } from '../../../shared/types';
import { Node } from '../Node/Node';
import { useFileOperations } from '../../hooks/useFileOperations';
import './Tree.css';

interface TreeProps {
  document: Document;
}

export function Tree({ document }: TreeProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { nodes, setNodes, rootNodeId } = useFileOperations(
    document.nodes,
    document.rootNodeId
  );

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
        nodeId={rootNodeId}
        nodes={nodes}
        nodeTypeConfig={document.nodeTypeConfig || {}}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
