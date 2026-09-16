import { pngWithDpi } from './pngDensity'
import { Capacitor } from '@capacitor/core'
import { saveFile } from './saveFile'
import type Konva from 'konva'
import type { SlideGroup } from '@/types'
import { withIdentityTransform } from './stageCapture'
import { getPanoSlideX, getPanoTotalWidth } from './panoGeometry'

interface WritableFileHandle {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<WritableFileHandle>
}

interface FileSystemDirectoryHandleLike {
  getDirectoryHandle?(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandleLike>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandleLike>
  }
}

export type PanoExportMode = 'split' | 'whole'

export interface ExportedImage {
  name: string
  dataUrl: string
}

type CaptureOptions = { x: number; y: number; width: number; height: number; pixelRatio: number; mimeType: string }
async function captureImage(stage: Konva.Stage, options: CaptureOptions, onBlobUrl?: (url: string) => void, dpi?: number): Promise<string> {
  if (!onBlobUrl) return withIdentityTransform(stage, () => stage.toDataURL(options))
  if (Capacitor.getPlatform() === 'android' && (options.width * options.height > 16_000_000 || Math.max(options.width, options.height) > 8192)) {
    throw new Error('This image is too large to export safely on this device. Choose split slides or a smaller canvas format.')
  }
  const canvas = withIdentityTransform(stage, () => stage.toCanvas(options))
  try {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not encode the exported image')), 'image/png'))
    const url = URL.createObjectURL(dpi ? await pngWithDpi(blob, dpi) : blob)
    onBlobUrl(url)
    return url
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

/**
 * Export a single slide from the Konva stage as a PNG data URL.
 * The stage must be at full resolution (no zoom scaling).
 */
export async function exportSlide(
  stage: Konva.Stage,
  slideIndex: number,
  group: SlideGroup,
  panoCompensationPx = 0,
  onBlobUrl?: (url: string) => void,
  dpi?: number,
): Promise<string> {
  const { slideWidth, slideHeight } = group
  return captureImage(stage, {
    x: getPanoSlideX(group, slideIndex, panoCompensationPx),
    y: 0,
    width: slideWidth,
    height: slideHeight,
    pixelRatio: 1,
    mimeType: 'image/png',
  }, onBlobUrl, dpi)
}

/**
 * Export all slides in a SlideGroup as PNG data URLs.
 */
export async function exportAllSlides(
  stage: Konva.Stage,
  group: SlideGroup,
  panoCompensationPx = 0,
  onImageCaptured?: (index: number, total: number) => void,
  signal?: AbortSignal,
  onBlobUrl?: (url: string) => void,
  dpi?: number,
): Promise<ExportedImage[]> {
  const results: ExportedImage[] = []
  for (let i = 0; i < group.numSlides; i++) {
    if (signal?.aborted) break
    const name = group.slideNames[i] ?? `slide-${i + 1}`
    const dataUrl = await exportSlide(stage, i, group, panoCompensationPx, onBlobUrl, dpi)
    results.push({ name, dataUrl })
    onImageCaptured?.(i + 1, group.numSlides)
  }
  return results
}

export async function exportWholeGroup(
  stage: Konva.Stage,
  group: SlideGroup,
  panoCompensationPx = 0,
  onBlobUrl?: (url: string) => void,
  dpi?: number,
): Promise<string> {
  return captureImage(stage, {
    x: 0,
    y: 0,
    width: getPanoTotalWidth(group, panoCompensationPx),
    height: group.slideHeight,
    pixelRatio: 1,
    mimeType: 'image/png',
  }, onBlobUrl, dpi)
}

export async function exportGroupImages(
  stage: Konva.Stage,
  group: SlideGroup,
  panoMode: PanoExportMode = 'split',
  panoCompensationPx = 0,
  onImageCaptured?: (index: number, total: number) => void,
  signal?: AbortSignal,
  onBlobUrl?: (url: string) => void,
  dpi?: number,
): Promise<ExportedImage[]> {
  if (panoMode === 'whole' && group.numSlides > 1) {
    if (signal?.aborted) return []
    const dataUrl = await exportWholeGroup(stage, group, panoCompensationPx, onBlobUrl, dpi)
    onImageCaptured?.(1, 1)
    return [{ name: group.name || 'pano', dataUrl }]
  }
  return exportAllSlides(stage, group, panoMode === 'split' ? panoCompensationPx : 0, onImageCaptured, signal, onBlobUrl, dpi)
}

/** Save PNG, JSON or another URL through the current platform's file picker. */
export async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob()
  await saveFile(blob, /\.[a-z0-9]+$/i.test(filename) ? filename : `${filename}.png`)
}
