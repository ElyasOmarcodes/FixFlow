import { chat, chatStream, editImage } from '@/ai/client'
import type { AiChatOptions, AiImageEditOptions } from '@/ai/client'
import { getFixFlowConfig } from '@/config'

export interface AiTransport {
  chat(options: AiChatOptions): Promise<string>
  editImage(options: AiImageEditOptions): Promise<string>
  /**
   * Optional: a transport that cannot stream simply does not offer this, and
   * `transportChatStream` falls back to `chat`. That is what keeps an injected
   * transport — a SaaS wrapper's, or a test's scripted one — working unchanged.
   */
  chatStream?(options: AiChatOptions, onDelta: (text: string) => void): Promise<string>
}

const directTransport: AiTransport = { chat, chatStream, editImage }

function resolveTransport(): AiTransport {
  return getFixFlowConfig().aiTransport ?? directTransport
}

export async function transportChat(options: AiChatOptions): Promise<string> {
  return resolveTransport().chat(options)
}

/** Stream where the transport can, and answer in one piece where it cannot. */
export async function transportChatStream(
  options: AiChatOptions,
  onDelta: (text: string) => void,
): Promise<string> {
  const transport = resolveTransport()
  if (transport.chatStream) return transport.chatStream(options, onDelta)
  const whole = await transport.chat(options)
  onDelta(whole)
  return whole
}

export async function transportEditImage(options: AiImageEditOptions): Promise<string> {
  return resolveTransport().editImage(options)
}
