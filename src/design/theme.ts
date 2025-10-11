export const theme = {
  colors: {
    primary: {
      50: 'bg-blue-50',
      500: 'border-blue-500',
      700: 'text-blue-700',
    },
    purple: {
      700: 'text-purple-700',
    },
    gray: {
      50: 'bg-gray-50',
      100: 'bg-gray-100',
      200: 'border-gray-200',
      500: 'text-gray-500',
      600: 'text-gray-600',
      700: 'text-gray-700',
      800: 'text-gray-800',
    },
  },
  spacing: {
    nodeIndent: 20, // pixels per depth level
    nodeGap: 'gap-2',
    nodePadding: 'py-1 px-2',
  },
  transitions: {
    default: 'transition-colors',
  },
  borders: {
    selected: 'border-l-4',
    rounded: 'rounded',
  },
  icons: {
    expand: '▶',
    collapse: '▼',
  },
};

export const componentStyles = {
  node: {
    base: 'flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-gray-100 transition-colors',
    selected: 'bg-blue-50 border-l-4 border-blue-500',
  },
  button: {
    base: 'w-4 h-4 flex items-center justify-center',
    hover: 'hover:text-gray-700',
    text: 'text-gray-500',
  },
  icon: {
    small: 'text-xs',
    base: 'text-sm',
  },
};
