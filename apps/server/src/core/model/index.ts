// The model layer. A slice imports from here; the adapters behind it are
// core's, and a new vendor is a new adapter, not a change to any caller.
export type {
  Completion,
  Message,
  ModelErrorKind,
  ModelProvider,
  ModelRequest,
  Role,
  StopReason,
  Tool,
  ToolCall,
  Usage,
} from './provider.js';
export { ModelError } from './provider.js';
export { nullModel } from './nullModel.js';
export { OpenAICompatible, type OpenAICompatibleOptions } from './openaiCompatible.js';
export { costOf, priceOf } from './pricing.js';
export { modelFromEnv, PROVIDERS, type ProviderName } from './fromEnv.js';
