import { useState } from 'react';
import { Document, NodeStatus } from '../../../shared/types';
import { Node } from '../Node/Node';
import { useFileOperations } from './fileOperations.hook';
import { useKeyboardNavigation } from './navigation.hook';
import './Tree.css';

interface TreeProps {
  document: Document;
}

export function Tree({ document }: TreeProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const { nodes, setNodes, rootNodeId } = useFileOperations(
    document.nodes,
    document.rootNodeId
  );

  useKeyboardNavigation(nodes, rootNodeId, selectedNodeId, setSelectedNodeId);

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

  const handleContentChange = (nodeId: string, content: string) => {
    setNodes((prevNodes) => ({
      ...prevNodes,
      [nodeId]: {
        ...prevNodes[nodeId],
        content,
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
        editingNodeId={editingNodeId}
        onSelectNode={setSelectedNodeId}
        onStartEdit={setEditingNodeId}
        onFinishEdit={() => setEditingNodeId(null)}
        onStatusChange={handleStatusChange}
        onContentChange={handleContentChange}
      />
    </div>
  );
}
