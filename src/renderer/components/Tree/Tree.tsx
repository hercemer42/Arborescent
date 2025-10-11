import { Node } from '../Node/Node';
import { useTreeStore } from '../../store/treeStore';
import { useFileOperations } from './fileOperations.hook';
import { useKeyboardNavigation } from './navigation.hook';
import './Tree.css';

export function Tree() {
  const rootNodeId = useTreeStore((state) => state.rootNodeId);

  useFileOperations();
  useKeyboardNavigation();

  if (!rootNodeId) {
    return null;
  }

  return (
    <div className="tree">
      <Node nodeId={rootNodeId} />
    </div>
  );
}
