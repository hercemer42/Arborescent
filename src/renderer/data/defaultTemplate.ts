import { NodeTypeConfig } from '../../shared/types';

export const defaultNodeTypeConfig: Record<string, NodeTypeConfig> = {
  project: {
    icon: '📁',
    style: '',
  },
  section: {
    icon: '📂',
    style: '',
  },
  task: {
    icon: '',
    style: '',
  },
  doc: {
    icon: '📄',
    style: '',
  },
};
