import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chat, editImage } from '@/ai/client'
import { getFixFlowConfig } from '@/config'
import { transportChat, transportChatStream, transportEditImage } from './transport'
import type { AiTransport } from './transport'

vi.mock('@/ai/client', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
  editImage: vi.fn(),
}))

vi.mock('@/config', () => ({
  getFixFlowConfig: vi.fn(),
}))

const mockedChat = vi.mocked(chat)
const mockedEditImage = vi.mocked(editImage)
const mockedGetFixFlowConfig = vi.mocked(getFixFlowConfig)

const chatOptions = {
  provider: 'openai' as const,
  apiKey: 'test-key',
  messages: [{ role: 'user' as const, content: 'Hello' }],
}

const imageEditOptions = {
  provider: 'openai' as const,
  apiKey: 'test-key',
  prompt: 'Translate the image text.',
  imageDataUrl: 'data:image/png;base64,test',
}

beforeEach(() => {
  mockedChat.mockReset()
  mockedEditImage.mockReset()
  mockedGetFixFlowConfig.mockReset()
  mockedGetFixFlowConfig.mockReturnValue({})
})

describe('AI transport', () => {
  it('delegates to the client transport when no override is configured', async () => {
    mockedChat.mockResolvedValue('chat result')
    mockedEditImage.mockResolvedValue('image result')

    await expect(transportChat(chatOptions)).resolves.toBe('chat result')
    await expect(transportEditImage(imageEditOptions)).resolves.toBe('image result')

    expect(mockedChat).toHaveBeenCalledWith(chatOptions)
    expect(mockedEditImage).toHaveBeenCalledWith(imageEditOptions)
  })

  it('uses an injected transport for chat and image editing', async () => {
    const injectedTransport: AiTransport = {
      chat: vi.fn().mockResolvedValue('injected chat'),
      editImage: vi.fn().mockResolvedValue('injected image'),
    }
    mockedGetFixFlowConfig.mockReturnValue({ aiTransport: injectedTransport })

    await expect(transportChat(chatOptions)).resolves.toBe('injected chat')
    await expect(transportEditImage(imageEditOptions)).resolves.toBe('injected image')

    expect(injectedTransport.chat).toHaveBeenCalledWith(chatOptions)
    expect(injectedTransport.editImage).toHaveBeenCalledWith(imageEditOptions)
    expect(mockedChat).not.toHaveBeenCalled()
    expect(mockedEditImage).not.toHaveBeenCalled()
  })

  it('propagates errors from the resolved transport unchanged', async () => {
    const error = new Error('Transport unavailable')
    const injectedTransport: AiTransport = {
      chat: vi.fn().mockRejectedValue(error),
      editImage: vi.fn(),
    }
    mockedGetFixFlowConfig.mockReturnValue({ aiTransport: injectedTransport })

    await expect(transportChat(chatOptions)).rejects.toBe(error)
  })
})

describe('streaming through the transport', () => {
  it('uses the transport\'s own stream when it has one', async () => {
    const chatStream = vi.fn(async (_options: unknown, onDelta: (text: string) => void) => { onDelta('piece'); return 'piece' })
    mockedGetFixFlowConfig.mockReturnValue({
      aiTransport: { chat: vi.fn(), editImage: vi.fn(), chatStream } as unknown as AiTransport,
    })

    const seen: string[] = []
    expect(await transportChatStream(chatOptions, (text) => seen.push(text))).toBe('piece')
    expect(seen).toEqual(['piece'])
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('falls back to one whole answer when the transport cannot stream', async () => {
    const chat = vi.fn().mockResolvedValue('whole answer')
    mockedGetFixFlowConfig.mockReturnValue({ aiTransport: { chat, editImage: vi.fn() } as unknown as AiTransport })

    const seen: string[] = []
    expect(await transportChatStream(chatOptions, (text) => seen.push(text))).toBe('whole answer')
    // One delta, carrying everything: a caller cannot tell the two apart.
    expect(seen).toEqual(['whole answer'])
  })
})
