declare module 'typo-js' {
  class Typo {
    constructor(
      dictionary?: string,
      affData?: string,
      dicData?: string,
      settings?: {
        dictionaryPath?: string;
        asyncLoad?: boolean;
        loadedCallback?: (typo: Typo) => void;
      }
    );
    check(word: string): boolean;
    suggest(word: string, limit?: number): string[];
    loaded: boolean;
  }
  export = Typo;
}

declare module 'typo-js/dictionaries/en_US/en_US.aff?raw' {
  const content: string;
  export default content;
}

declare module 'typo-js/dictionaries/en_US/en_US.dic?raw' {
  const content: string;
  export default content;
}
