import { Node } from '../Node/Node';
import { useTreeStore } from '../../store/treeStore';
import { useTreeListeners } from './useTreeListeners';
import './Tree.css';

export function Tree() {
  const rootNodeId = useTreeStore((state) => state.rootNodeId);

  useTreeListeners();

  if (!rootNodeId) {
    return null;
  }

  return (
    <div className="tree">
      <Node nodeId={rootNodeId} />
    </div>
  );
}
