import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';

export type StepType = 'manual' | 'checkpoint' | 'autonomous';

export class SetStepTypeCommand extends BaseCommand {
  private previousStepType: StepType | undefined;

  constructor(
    private nodeId: string,
    private newStepType: StepType,
    private getNodes: () => Record<string, TreeNode>,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Set step type ${nodeId} to ${newStepType}`;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    this.previousStepType = node.metadata.stepType as StepType | undefined;

    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          stepType: this.newStepType,
        },
      },
    });

    this.triggerAutosave?.();
  }

  undo(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    const updatedMetadata = { ...node.metadata };
    if (this.previousStepType === undefined) {
      delete updatedMetadata.stepType;
    } else {
      updatedMetadata.stepType = this.previousStepType;
    }

    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: updatedMetadata,
      },
    });

    this.triggerAutosave?.();
  }

  redo(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          stepType: this.newStepType,
        },
      },
    });

    this.triggerAutosave?.();
  }
}
