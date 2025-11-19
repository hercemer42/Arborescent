// Type declarations for Electron webview element
declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLWebViewElement> & {
        src?: string;
        autosize?: string;
        nodeintegration?: string;
        partition?: string;
        allowpopups?: string;
        preload?: string;
        httpreferrer?: string;
        useragent?: string;
        disablewebsecurity?: string;
        webpreferences?: string;
      },
      HTMLWebViewElement
    >;
  }
}

interface HTMLWebViewElement extends HTMLElement {
  src: string;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  stop(): void;
  loadURL(url: string): void;
  getURL(): string;
  getTitle(): string;
  isLoading(): boolean;
  addEventListener(event: string, listener: (e: Event) => void): void;
  removeEventListener(event: string, listener: (e: Event) => void): void;
}
