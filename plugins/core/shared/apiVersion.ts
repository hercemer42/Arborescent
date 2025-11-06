/**
 * Current Plugin API version.
 *
 * Follows semantic versioning (MAJOR.MINOR.PATCH):
 * - MAJOR: Incompatible API changes (breaking changes)
 * - MINOR: Backward-compatible new features
 * - PATCH: Backward-compatible bug fixes
 */
export const PLUGIN_API_VERSION = '1.0.0';

/**
 * Checks if a plugin's API version is compatible with the current API version.
 *
 * Compatibility rules:
 * - No apiVersion specified: Compatible (assume v1.0.0 for backward compatibility)
 * - Same major version: Compatible
 * - Different major version: Incompatible
 *
 * @param pluginApiVersion - The API version from the plugin manifest
 * @returns Object with compatibility status and optional warning message
 */
export function checkApiCompatibility(pluginApiVersion?: string): {
  compatible: boolean;
  warning?: string;
} {
  if (!pluginApiVersion) {
    return { compatible: true };
  }

  const currentMajor = parseInt(PLUGIN_API_VERSION.split('.')[0], 10);
  const pluginMajor = parseInt(pluginApiVersion.split('.')[0], 10);

  if (isNaN(pluginMajor)) {
    return {
      compatible: false,
      warning: `Invalid API version format: ${pluginApiVersion}`,
    };
  }

  if (pluginMajor !== currentMajor) {
    return {
      compatible: false,
      warning: `Incompatible API version: plugin requires v${pluginApiVersion}, but current API is v${PLUGIN_API_VERSION}`,
    };
  }

  return { compatible: true };
}
