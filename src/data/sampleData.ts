import { Document } from '../types';

export const sampleDocument: Document = {
  version: '1.0',
  rootNodeId: 'root',
  nodeTypeConfig: {
    project: {
      icon: '📁',
      style: 'text-blue-700 font-bold text-lg',
    },
    section: {
      icon: '📂',
      style: 'text-purple-700 font-semibold',
    },
    task: {
      icon: '',
      style: 'text-gray-800',
    },
    doc: {
      icon: '📄',
      style: 'text-gray-600 italic',
    },
  },
  nodes: {
    root: {
      id: 'root',
      type: 'project',
      content: 'Arborescent Development',
      children: ['arch', 'features'],
      metadata: {
        created: new Date().toISOString(),
      },
    },
    arch: {
      id: 'arch',
      type: 'section',
      content: 'Architecture',
      children: ['arch-1', 'arch-2'],
      metadata: {},
    },
    'arch-1': {
      id: 'arch-1',
      type: 'doc',
      content: 'Use React + TypeScript for type safety',
      children: [],
      metadata: {},
    },
    'arch-2': {
      id: 'arch-2',
      type: 'doc',
      content: 'Electron for local-first file access',
      children: [],
      metadata: {},
    },
    features: {
      id: 'features',
      type: 'section',
      content: 'Features',
      children: ['week1', 'week2'],
      metadata: {},
    },
    week1: {
      id: 'week1',
      type: 'section',
      content: 'Week 1: Tree UI',
      children: ['task-1', 'task-2', 'task-3'],
      metadata: {},
    },
    'task-1': {
      id: 'task-1',
      type: 'task',
      content: 'Recursive tree component',
      children: [],
      metadata: {
        status: '✓',
      },
    },
    'task-2': {
      id: 'task-2',
      type: 'task',
      content: 'Expand/collapse functionality',
      children: [],
      metadata: {
        status: '☐',
      },
    },
    'task-3': {
      id: 'task-3',
      type: 'task',
      content: 'Node selection',
      children: [],
      metadata: {
        status: '☐',
      },
    },
    week2: {
      id: 'week2',
      type: 'section',
      content: 'Week 2: CRUD Operations',
      children: ['task-4', 'task-5'],
      metadata: {},
    },
    'task-4': {
      id: 'task-4',
      type: 'task',
      content: 'Add child node functionality',
      children: [],
      metadata: {
        status: '☐',
      },
    },
    'task-5': {
      id: 'task-5',
      type: 'task',
      content: 'Edit node content inline',
      children: [],
      metadata: {
        status: '☐',
      },
    },
  },
};
