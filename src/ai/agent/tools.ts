import { nanoid } from 'nanoid'
import { useEditorStore } from '@/store'
import { ICON_LIBRARY } from '@/assets/icons/library'
import { getPhoneSpec } from '@/assets/mockups/specs'
import { describeProject, describeSlideGroup } from './snapshot'
import type {
  ChipLayer, GroupLayer, IconLayer, Layer, LayerType, ShapeLayer, ShapeType, SlideGroup, TextLayer,
} from '@/types'

/**
 * What the assistant can actually do.
 *
 * Every tool is a small, named operation over the editor store, and every one
 * of them answers with a *string* — including its failures. That is the whole
 * trick of the loop: a tool that throws ends the turn and leaves the person
 * with half a change, whereas a tool that answers "no layer with id abc" hands
 * the model something it can correct on the next round, which is what it does.
 *
 * Nothing here talks to the network and nothing here decides undo boundaries;
 * `agentSlice` owns the turn, so a failed turn rolls back whole.
 */

export interface AgentTool {
  name: string
  /** One line, shown to the model. Kept short — this is prompt weight. */
  summary: string
  /** The argument shape, documented in the same one-line style. */
  args: string
  /** Reads nothing but state; safe to run in proposal mode. */
  readOnly?: boolean
  run: (args: Record<string, unknown>) => string
}

/** What a tool did, for the transcript and for the canvas highlight. */
export interface AgentToolResult {
  tool: string
  args: Record<string, unknown>
  result: string
  failed: boolean
  /** Layers this call created or changed, so the canvas can flash them. */
  touched: string[]
}

// ── Argument coercion ────────────────────────────────────────────────────────
// Models send "120" for a number and 1 for a boolean often enough that reading
// the value leniently is the difference between a turn that works and one that
// spends a round being told off.

function str(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return undefined
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function ids(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => str(entry)).filter((entry): entry is string => !!entry)
  const single = str(value)
  return single ? [single] : []
}

// ── State helpers ────────────────────────────────────────────────────────────

function activeGroup(): SlideGroup | undefined {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((group) => group.id === activeSlideGroupId)
}

/** A layer plus the group it lives in — a child is patched through a different action. */
interface Located { layer: Layer; parentGroupId: string | null }

function locate(layerId: string): Located | undefined {
  const group = activeGroup()
  if (!group) return undefined
  for (const layer of group.layers) {
    if (layer.id === layerId) return { layer, parentGroupId: null }
    if (layer.type === 'group') {
      const child = (layer as GroupLayer).children.find((entry) => entry.id === layerId)
      if (child) return { layer: child, parentGroupId: layer.id }
    }
  }
  return undefined
}

/** Patch a layer wherever it lives, top-level or inside a group. */
function patchLayer(found: Located, patch: Partial<Layer>): void {
  const store = useEditorStore.getState()
  if (found.parentGroupId) store.updateChildLayer(found.parentGroupId, found.layer.id, patch)
  else store.updateLayer(found.layer.id, patch)
}

function missing(layerId: string): string {
  return `Error: no layer with id "${layerId}" on the active slide. Call read_slide to see the current ids.`
}

// ── What a model is allowed to write ─────────────────────────────────────────
/**
 * Per-type whitelists.
 *
 * Not defence against an attacker — it is defence against a plausible mistake.
 * A model that writes `type`, `children`, `localeContent` or `formatOverrides`
 * does not produce an error, it produces a layer that renders wrong later, in
 * another locale or another format, long after the conversation is closed.
 */
const COMMON_KEYS = ['name', 'x', 'y', 'rotation', 'opacity', 'visible', 'locked', 'blur'] as const

const WRITABLE: Record<string, readonly string[]> = {
  text: [...COMMON_KEYS, 'text', 'fontFamily', 'fontSize', 'fontWeight', 'italic', 'underline', 'fill',
    'letterSpacing', 'lineHeight', 'align', 'width', 'height', 'verticalAlign'],
  chip: [...COMMON_KEYS, 'text', 'fontFamily', 'fontSize', 'fontWeight', 'textColor', 'fill', 'cornerRadius',
    'paddingX', 'paddingY', 'icon', 'iconSize', 'iconGap', 'iconPosition'],
  icon: [...COMMON_KEYS, 'icon', 'size', 'color', 'strokeWidth', 'background', 'backgroundPadding', 'backgroundRadius'],
  shape: [...COMMON_KEYS, 'shapeType', 'width', 'height', 'fill', 'cornerRadius', 'stroke', 'strokeWidth'],
  phone: [...COMMON_KEYS, 'model', 'scale', 'screenshotFit', 'showStatusBar', 'statusBarTheme'],
  image: [...COMMON_KEYS, 'width', 'height', 'cornerRadius'],
  group: [...COMMON_KEYS, 'scale'],
  background: ['fill', 'noise', 'imageOverlayColor', 'imageOverlayOpacity'],
  emoji: [...COMMON_KEYS, 'emoji', 'fontSize'],
  brand: [...COMMON_KEYS, 'appName', 'logoSize', 'nameColor', 'nameFontSize', 'nameFontFamily'],
}

/** Keep only the keys this layer type accepts; report the rest rather than silently dropping them. */
function filterPatch(type: LayerType, patch: Record<string, unknown>): { patch: Partial<Layer>; rejected: string[] } {
  const allowed = WRITABLE[type] ?? COMMON_KEYS
  const kept: Record<string, unknown> = {}
  const rejected: string[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (allowed.includes(key)) kept[key] = value
    else rejected.push(key)
  }
  return { patch: kept as Partial<Layer>, rejected }
}

const ICON_NAMES = new Set(ICON_LIBRARY.map((glyph) => glyph.name))

// ── Layer construction ───────────────────────────────────────────────────────

const SHAPE_TYPES: ShapeType[] = ['rect', 'ellipse', 'arrow', 'triangle', 'star', 'pentagon', 'hexagon', 'diamond', 'cross', 'check']

function baseLayer(type: LayerType, name: string, args: Record<string, unknown>, group: SlideGroup) {
  return {
    id: nanoid(),
    name: str(args.name) ?? name,
    type,
    x: num(args.x) ?? Math.round(group.slideWidth * 0.1),
    y: num(args.y) ?? Math.round(group.slideHeight * 0.2),
    rotation: num(args.rotation) ?? 0,
    opacity: num(args.opacity) ?? 1,
    visible: true,
    locked: false,
  }
}

/**
 * Build a layer from loose arguments.
 *
 * Defaults are proportional to the canvas, not absolute: the same request has
 * to produce a sane layer on a 1290×2796 phone slide and on a 2064×2752 tablet
 * one, and a model that guesses `fontSize: 48` for both gets one of them wrong.
 */
function buildLayer(args: Record<string, unknown>, group: SlideGroup): Layer | string {
  const type = str(args.layerType) ?? str(args.type)
  const width = group.slideWidth

  switch (type) {
    case 'text': {
      const text = str(args.text)
      if (!text) return 'Error: add_layer of type "text" needs a "text" argument.'
      const layer: TextLayer = {
        ...baseLayer('text', text.slice(0, 24), args, group),
        type: 'text',
        text,
        fontFamily: str(args.fontFamily) ?? 'Sora',
        fontSize: num(args.fontSize) ?? Math.round(width * 0.07),
        fontWeight: num(args.fontWeight) ?? 700,
        fill: (args.fill as TextLayer['fill']) ?? '#FFFFFF',
        letterSpacing: num(args.letterSpacing) ?? 0,
        lineHeight: num(args.lineHeight) ?? 1.1,
        align: (str(args.align) as TextLayer['align']) ?? 'left',
        width: num(args.width) ?? Math.round(width * 0.8),
      }
      return layer
    }
    case 'chip': {
      const text = str(args.text)
      if (!text) return 'Error: add_layer of type "chip" needs a "text" argument.'
      const icon = str(args.icon)
      if (icon && !ICON_NAMES.has(icon)) return `Error: "${icon}" is not a bundled glyph. Call list_icons for the names.`
      const layer: ChipLayer = {
        ...baseLayer('chip', text.slice(0, 24), args, group),
        type: 'chip',
        text,
        fontFamily: str(args.fontFamily) ?? 'Inter',
        fontSize: num(args.fontSize) ?? Math.round(width * 0.028),
        fontWeight: num(args.fontWeight) ?? 700,
        textColor: str(args.textColor) ?? '#FFFFFF',
        fill: (args.fill as ChipLayer['fill']) ?? '#FF6F61',
        cornerRadius: num(args.cornerRadius) ?? Math.round(width * 0.03),
        paddingX: num(args.paddingX) ?? Math.round(width * 0.025),
        paddingY: num(args.paddingY) ?? Math.round(width * 0.014),
        iconSize: num(args.iconSize) ?? Math.round(width * 0.026),
        iconGap: num(args.iconGap) ?? Math.round(width * 0.01),
        iconPosition: str(args.iconPosition) === 'right' ? 'right' : 'left',
        ...(icon ? { icon } : {}),
      }
      return layer
    }
    case 'icon': {
      const name = str(args.icon) ?? 'star'
      if (!ICON_NAMES.has(name)) return `Error: "${name}" is not a bundled glyph. Call list_icons for the names.`
      const size = num(args.size) ?? Math.round(width * 0.09)
      const layer: IconLayer = {
        ...baseLayer('icon', name.replace(/[-_]/g, ' '), args, group),
        type: 'icon',
        icon: name,
        size,
        color: str(args.color) ?? '#FFFFFF',
        strokeWidth: num(args.strokeWidth) ?? (size / 24) * 2,
        backgroundPadding: num(args.backgroundPadding) ?? 0,
        backgroundRadius: num(args.backgroundRadius) ?? Math.round(size * 0.25),
        ...(args.background ? { background: args.background as IconLayer['background'] } : {}),
      }
      return layer
    }
    case 'shape': {
      const shapeType = str(args.shapeType) as ShapeType | undefined
      const layer: ShapeLayer = {
        ...baseLayer('shape', 'Shape', args, group),
        type: 'shape',
        shapeType: shapeType && SHAPE_TYPES.includes(shapeType) ? shapeType : 'rect',
        width: num(args.width) ?? Math.round(width * 0.5),
        height: num(args.height) ?? Math.round(width * 0.3),
        fill: (args.fill as ShapeLayer['fill']) ?? '#FFFFFF',
        cornerRadius: num(args.cornerRadius) ?? Math.round(width * 0.03),
        ...(str(args.stroke) ? { stroke: str(args.stroke), strokeWidth: num(args.strokeWidth) ?? 2 } : {}),
      }
      return layer
    }
    case 'phone': {
      // The phone is the one layer whose default is a fit rather than a guess:
      // a model choosing `scale` for a device frame it cannot measure puts it
      // through the floor of the slide about half the time.
      const model = (str(args.model) ?? 'iphone-16-pro') as never
      let spec
      try { spec = getPhoneSpec(model) } catch { return `Error: unknown phone model "${String(model)}".` }
      const scale = num(args.scale) ?? (group.slideHeight * 0.62) / spec.frameHeight
      return {
        ...baseLayer('phone', 'Phone', args, group),
        type: 'phone',
        x: num(args.x) ?? Math.round((group.slideWidth - spec.frameWidth * scale) / 2),
        y: num(args.y) ?? Math.round(group.slideHeight * 0.35),
        model,
        scale,
        screenshotFit: 'cover',
        screenshotOffsetX: 0,
        screenshotOffsetY: 0,
        showStatusBar: true,
        statusBarTheme: 'dark',
        statusBarBg: 'transparent',
        statusBarColor: '#000000',
      } as Layer
    }
    default:
      return `Error: add_layer needs layerType to be one of text, chip, icon, shape, phone (got "${String(type)}").`
  }
}

// ── The catalogue ────────────────────────────────────────────────────────────

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'read_slide',
    summary: 'Read the layers of a slide group, with their ids.',
    args: '{ "slideGroupId"?: string }  — omit for the slide being edited',
    readOnly: true,
    run: (args) => {
      const { project, activeSlideGroupId } = useEditorStore.getState()
      const wanted = str(args.slideGroupId) ?? activeSlideGroupId
      const group = project.slideGroups.find((entry) => entry.id === wanted)
      return group ? describeSlideGroup(group) : `Error: no slide group with id "${wanted}".`
    },
  },
  {
    name: 'read_project',
    summary: 'List every slide group, the brand colours and the locales.',
    args: '{}',
    readOnly: true,
    run: () => {
      const { project, activeSlideGroupId } = useEditorStore.getState()
      return describeProject(project, activeSlideGroupId)
    },
  },
  {
    name: 'list_icons',
    summary: 'The glyph names an icon or chip can use.',
    args: '{ "query"?: string }',
    readOnly: true,
    run: (args) => {
      const query = str(args.query)?.toLowerCase()
      const names = [...ICON_NAMES].filter((name) => !query || name.includes(query))
      if (names.length === 0) return `No glyph matches "${query}". Try a broader word.`
      return names.join(', ')
    },
  },
  {
    name: 'add_layer',
    summary: 'Add one layer to the slide being edited.',
    args: '{ "layerType": "text"|"chip"|"icon"|"shape"|"phone", "text"?, "icon"?, "x"?, "y"?, "fontSize"?, "fill"?, … }',
    run: (args) => {
      const group = activeGroup()
      if (!group) return 'Error: no slide group is active.'
      const built = buildLayer(args, group)
      if (typeof built === 'string') return built
      useEditorStore.getState().addLayer(built)
      return `Added ${built.type} "${built.name}" as ${built.id}.`
    },
  },
  {
    name: 'update_layer',
    summary: 'Change properties of an existing layer.',
    args: '{ "id": string, "patch": { … } }  — patch keys are the layer\'s own properties',
    run: (args) => {
      const id = str(args.id)
      if (!id) return 'Error: update_layer needs an "id".'
      const found = locate(id)
      if (!found) return missing(id)
      const raw = (args.patch ?? args.properties) as Record<string, unknown> | undefined
      if (!raw || typeof raw !== 'object') return 'Error: update_layer needs a "patch" object.'
      const { patch, rejected } = filterPatch(found.layer.type, raw)
      if (Object.keys(patch).length === 0) {
        return `Error: none of ${rejected.join(', ') || '(nothing)'} can be set on a ${found.layer.type} layer.`
      }
      patchLayer(found, patch)
      const note = rejected.length ? ` Ignored: ${rejected.join(', ')}.` : ''
      return `Updated ${found.layer.type} ${id} (${Object.keys(patch).join(', ')}).${note}`
    },
  },
  {
    name: 'move_layer',
    summary: 'Move a layer, absolutely or by an offset.',
    args: '{ "id": string, "x"?: number, "y"?: number, "dx"?: number, "dy"?: number }',
    run: (args) => {
      const id = str(args.id)
      if (!id) return 'Error: move_layer needs an "id".'
      const found = locate(id)
      if (!found) return missing(id)
      const x = num(args.x) ?? found.layer.x + (num(args.dx) ?? 0)
      const y = num(args.y) ?? found.layer.y + (num(args.dy) ?? 0)
      patchLayer(found, { x, y } as Partial<Layer>)
      return `Moved ${id} to ${Math.round(x)},${Math.round(y)}.`
    },
  },
  {
    name: 'delete_layer',
    summary: 'Remove a layer.',
    args: '{ "id": string }',
    run: (args) => {
      const id = str(args.id)
      if (!id) return 'Error: delete_layer needs an "id".'
      const found = locate(id)
      if (!found) return missing(id)
      if (found.layer.type === 'background') return 'Error: the background layer cannot be deleted — set_background repaints it instead.'
      if (found.parentGroupId) useEditorStore.getState().removeFromGroup(found.parentGroupId, id)
      else useEditorStore.getState().removeLayer(id)
      return `Deleted ${found.layer.type} ${id}.`
    },
  },
  {
    name: 'duplicate_layer',
    summary: 'Copy a layer, offset slightly from the original.',
    args: '{ "id": string }',
    run: (args) => {
      const id = str(args.id)
      if (!id) return 'Error: duplicate_layer needs an "id".'
      const found = locate(id)
      if (!found) return missing(id)
      if (found.parentGroupId) return 'Error: duplicate_layer works on top-level layers; this one is inside a group.'
      const before = new Set(activeGroup()?.layers.map((layer) => layer.id) ?? [])
      useEditorStore.getState().duplicateLayer(id)
      const added = activeGroup()?.layers.find((layer) => !before.has(layer.id))
      return added ? `Duplicated ${id} as ${added.id}.` : `Duplicated ${id}.`
    },
  },
  {
    name: 'reorder_layer',
    summary: 'Change what a layer is drawn in front of.',
    args: '{ "id": string, "to": "front"|"back"|"forward"|"backward" }',
    run: (args) => {
      const id = str(args.id)
      const to = str(args.to) ?? 'front'
      if (!id) return 'Error: reorder_layer needs an "id".'
      if (!locate(id)) return missing(id)
      const store = useEditorStore.getState()
      const move = { front: store.bringLayerToFront, back: store.sendLayerToBack, forward: store.bringLayerForward, backward: store.sendLayerBackward }[to]
      if (!move) return 'Error: "to" must be front, back, forward or backward.'
      move(id)
      return `Moved ${id} ${to}.`
    },
  },
  {
    name: 'group_layers',
    summary: 'Combine layers into one group, so they move together.',
    args: '{ "ids": string[], "name"?: string }',
    run: (args) => {
      const list = ids(args.ids)
      if (list.length < 2) return 'Error: group_layers needs at least two ids.'
      const unknown = list.filter((id) => !locate(id))
      if (unknown.length) return `Error: unknown ids: ${unknown.join(', ')}.`
      const before = new Set(activeGroup()?.layers.map((layer) => layer.id) ?? [])
      useEditorStore.getState().createGroup(list)
      const created = activeGroup()?.layers.find((layer) => !before.has(layer.id))
      if (created && str(args.name)) useEditorStore.getState().updateLayer(created.id, { name: str(args.name) } as Partial<Layer>)
      return created ? `Grouped ${list.length} layers as ${created.id}.` : `Grouped ${list.length} layers.`
    },
  },
  {
    name: 'ungroup_layer',
    summary: 'Break a group back into its layers.',
    args: '{ "id": string }',
    run: (args) => {
      const id = str(args.id)
      if (!id) return 'Error: ungroup_layer needs an "id".'
      const found = locate(id)
      if (!found) return missing(id)
      if (found.layer.type !== 'group') return `Error: ${id} is a ${found.layer.type}, not a group.`
      useEditorStore.getState().dissolveGroup(id)
      return `Ungrouped ${id}.`
    },
  },
  {
    name: 'align_layers',
    summary: 'Line layers up against the slide or against each other.',
    args: '{ "ids": string[], "edge": "left"|"right"|"centerX"|"top"|"bottom"|"centerY", "to"?: "slide"|"selection" }',
    run: (args) => {
      const list = ids(args.ids)
      const edge = str(args.edge)
      const group = activeGroup()
      if (!group) return 'Error: no slide group is active.'
      if (list.length === 0) return 'Error: align_layers needs "ids".'
      const found = list.map((id) => locate(id)).filter((entry): entry is Located => !!entry)
      if (found.length !== list.length) return `Error: unknown ids: ${list.filter((id) => !locate(id)).join(', ')}.`

      const boxes = found.map((entry) => ({ entry, box: layerBox(entry.layer) }))
      const toSlide = (str(args.to) ?? 'slide') === 'slide'
      const left = toSlide ? 0 : Math.min(...boxes.map((item) => item.entry.layer.x))
      const right = toSlide ? group.slideWidth * group.numSlides : Math.max(...boxes.map((item) => item.entry.layer.x + item.box.width))
      const top = toSlide ? 0 : Math.min(...boxes.map((item) => item.entry.layer.y))
      const bottom = toSlide ? group.slideHeight : Math.max(...boxes.map((item) => item.entry.layer.y + item.box.height))

      for (const { entry, box } of boxes) {
        const patch: Record<string, number> = {}
        if (edge === 'left') patch.x = left
        else if (edge === 'right') patch.x = right - box.width
        else if (edge === 'centerX') patch.x = left + (right - left - box.width) / 2
        else if (edge === 'top') patch.y = top
        else if (edge === 'bottom') patch.y = bottom - box.height
        else if (edge === 'centerY') patch.y = top + (bottom - top - box.height) / 2
        else return 'Error: "edge" must be left, right, centerX, top, bottom or centerY.'
        patchLayer(entry, patch as Partial<Layer>)
      }
      return `Aligned ${found.length} layers ${edge} against the ${toSlide ? 'slide' : 'selection'}.`
    },
  },
  {
    name: 'set_background',
    summary: 'Repaint the slide background with a colour or a gradient.',
    args: '{ "fill": "#RRGGBB" | { "type": "linear", "angle": number, "stops": [{ "offset": 0, "color": "#…" }, …] } }',
    run: (args) => {
      const group = activeGroup()
      if (!group) return 'Error: no slide group is active.'
      const background = group.layers.find((layer) => layer.type === 'background')
      if (!background) return 'Error: this slide has no background layer.'
      const fill = args.fill
      if (typeof fill !== 'string' && !(fill && typeof fill === 'object' && 'stops' in fill)) {
        return 'Error: "fill" must be a hex colour or a gradient object with stops.'
      }
      useEditorStore.getState().updateLayer(background.id, { fill } as Partial<Layer>)
      return 'Repainted the background.'
    },
  },
  {
    name: 'select_layers',
    summary: 'Select layers so the person can see what you mean.',
    args: '{ "ids": string[] }',
    run: (args) => {
      const list = ids(args.ids)
      const store = useEditorStore.getState()
      if (list.length === 0) { store.deselect(); return 'Cleared the selection.' }
      const unknown = list.filter((id) => !locate(id))
      if (unknown.length) return `Error: unknown ids: ${unknown.join(', ')}.`
      if (list.length === 1) store.select(list[0])
      else store.setMultiSelection(list)
      return `Selected ${list.length} layer${list.length === 1 ? '' : 's'}.`
    },
  },
  {
    name: 'set_active_slide',
    summary: 'Switch to another slide group before editing it.',
    args: '{ "slideGroupId": string }',
    run: (args) => {
      const id = str(args.slideGroupId)
      if (!id) return 'Error: set_active_slide needs a "slideGroupId".'
      const { project } = useEditorStore.getState()
      const group = project.slideGroups.find((entry) => entry.id === id)
      if (!group) return `Error: no slide group with id "${id}".`
      useEditorStore.getState().setActiveSlideGroup(id)
      return `Now editing "${group.name}".`
    },
  },
]

/** A layer's on-canvas box, as far as a bare layer record can say. */
function layerBox(layer: Layer): { width: number; height: number } {
  switch (layer.type) {
    case 'text': {
      const text = layer as TextLayer
      return { width: text.width ?? text.fontSize * 8, height: text.fontSize * text.lineHeight }
    }
    case 'shape':
    case 'image':
      return { width: (layer as ShapeLayer).width, height: (layer as ShapeLayer).height }
    case 'icon': {
      const icon = layer as IconLayer
      const side = icon.size + icon.backgroundPadding * 2
      return { width: side, height: side }
    }
    case 'chip': {
      const chip = layer as ChipLayer
      return {
        width: chip.text.length * chip.fontSize * 0.55 + chip.paddingX * 2 + (chip.icon ? chip.iconSize + chip.iconGap : 0),
        height: chip.fontSize * 1.2 + chip.paddingY * 2,
      }
    }
    default:
      return { width: 0, height: 0 }
  }
}

const BY_NAME = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool]))

export function findTool(name: string): AgentTool | undefined {
  return BY_NAME.get(name)
}

/**
 * Run one call.
 *
 * A tool that throws is reported as a failed call rather than allowed to end
 * the turn: the loop's whole value is that the model gets to read what went
 * wrong and try something else.
 */
export function runTool(name: string, args: Record<string, unknown>): AgentToolResult {
  const tool = findTool(name)
  if (!tool) {
    return {
      tool: name, args, failed: true, touched: [],
      result: `Error: there is no tool called "${name}". Available: ${AGENT_TOOLS.map((entry) => entry.name).join(', ')}.`,
    }
  }
  const before = layerIdsNow()
  try {
    const result = tool.run(args)
    return { tool: name, args, result, failed: result.startsWith('Error:'), touched: touchedSince(before, args) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { tool: name, args, result: `Error: ${message}`, failed: true, touched: [] }
  }
}

function layerIdsNow(): Set<string> {
  const group = activeGroup()
  const found = new Set<string>()
  for (const layer of group?.layers ?? []) {
    found.add(layer.id)
    if (layer.type === 'group') for (const child of (layer as GroupLayer).children) found.add(child.id)
  }
  return found
}

/** New ids, plus whatever the call names — enough for the canvas to flash the right layers. */
function touchedSince(before: Set<string>, args: Record<string, unknown>): string[] {
  const now = layerIdsNow()
  const added = [...now].filter((id) => !before.has(id))
  const named = [...ids(args.ids), ...(str(args.id) ? [str(args.id) as string] : [])].filter((id) => now.has(id))
  return [...new Set([...added, ...named])]
}

/** The catalogue as the model sees it. */
export function toolCatalogue(): string {
  return AGENT_TOOLS.map((tool) => `- ${tool.name}: ${tool.summary}\n  args ${tool.args}`).join('\n')
}
