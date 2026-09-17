import { chat, editImage } from '@/ai/client'
import type { AiChatOptions, AiImageEditOptions } from '@/ai/client'
import { getFixFlowConfig } from '@/config'

export interface AiTransport {
  chat(options: AiChatOptions): Promise<string>
  editImage(options: AiImageEditOptions): Promise<string>
}

const directTransport: AiTransport = { chat, editImage }

function resolveTransport(): AiTransport {
  return getFixFlowConfig().aiTransport ?? directTransport
}

export async function transportChat(options: AiChatOptions): Promise<string> {
  return resolveTransport().chat(options)
}

export async function transportEditImage(options: AiImageEditOptions): Promise<string> {
  return resolveTransport().editImage(options)
}
