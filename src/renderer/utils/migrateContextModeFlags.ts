import type { TreeNode } from '../../shared/types';

type LegacyContextMode = 'collaborate' | 'execute';

const LEGACY_DEFAULT_FLAGS = { collaborate: true, execute: false };
const LEGACY_EXECUTE_FLAGS = { collaborate: true, execute: true };

function legacyToFlags(legacy: LegacyContextMode | undefined): { collaborate: boolean; execute: boolean } {
  if (legacy === 'execute') return LEGACY_EXECUTE_FLAGS;
  return LEGACY_DEFAULT_FLAGS;
}

function applyMigration(node: TreeNode): TreeNode {
  const legacy = node.metadata.contextMode as LegacyContextMode | undefined;
  const cleanMetadata = { ...node.metadata };
  delete cleanMetadata.contextMode;

  const alreadyHasFlags = 'collaborate' in cleanMetadata || 'execute' in cleanMetadata;
  if (alreadyHasFlags) {
    return { ...node, metadata: cleanMetadata };
  }

  const flags = legacyToFlags(legacy);
  return {
    ...node,
    metadata: {
      ...cleanMetadata,
      collaborate: flags.collaborate,
      execute: flags.execute,
    },
  };
}

export function migrateContextModeFlags(
  nodes: Record<string, TreeNode>,
): Record<string, TreeNode> {
  let migrated: Record<string, TreeNode> | null = null;

  for (const [id, node] of Object.entries(nodes)) {
    if (node.metadata.isContextDeclaration !== true) continue;

    const hasLegacy = 'contextMode' in node.metadata;
    const hasFlags = 'collaborate' in node.metadata || 'execute' in node.metadata;
    if (hasFlags && !hasLegacy) continue;

    if (!migrated) migrated = { ...nodes };
    migrated[id] = applyMigration(node);
  }

  return migrated ?? nodes;
}
