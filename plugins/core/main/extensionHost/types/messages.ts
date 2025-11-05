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

export type {
  RegisterPluginPayload,
  UnregisterPluginPayload,
  InvokeExtensionPayload,
  ResponsePayload,
  ErrorPayload,
  PluginManifest,
  IPCCallMessage,
  IPCResponseMessage,
  LogMessage,
} from './messageValidation';
