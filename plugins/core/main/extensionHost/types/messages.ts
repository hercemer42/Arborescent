export enum MessageType {
  RegisterPlugin = 'registerPlugin',
  UnregisterPlugin = 'unregisterPlugin',
  InitializePlugins = 'initializePlugins',
  DisposePlugins = 'disposePlugins',
  InvokeExtension = 'invokeExtension',
  Response = 'response',
  Error = 'error',
  Ready = 'ready',
  StoreUpdate = 'storeUpdate',
}

export interface BaseMessage {
  type: MessageType;
  id: string;
  payload: unknown;
}

export interface RendererMessage extends BaseMessage {
  type:
    | MessageType.RegisterPlugin
    | MessageType.UnregisterPlugin
    | MessageType.InitializePlugins
    | MessageType.DisposePlugins
    | MessageType.InvokeExtension;
}

export interface ExtensionHostMessage extends BaseMessage {
  type: MessageType.Response | MessageType.Error | MessageType.Ready | MessageType.StoreUpdate;
}

export interface RegisterPluginPayload {
  pluginName: string;
  pluginPath: string;
}

export interface UnregisterPluginPayload {
  pluginName: string;
}

export interface InvokeExtensionPayload {
  pluginName: string;
  extensionPoint: string;
  args: unknown[];
}

export interface ResponsePayload {
  success?: boolean;
  result?: unknown;
  manifest?: unknown;
}

export interface ErrorPayload {
  message: string;
  stack?: string;
}
