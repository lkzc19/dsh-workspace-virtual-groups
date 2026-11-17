/**
 * 分组折叠/展开的高度动画。
 *
 * 官方行是我们不拥有的 DOM，无法在外面包一层做 `grid-template-rows` 过渡；
 * 但它们都是列表里的流式子项，所以直接过渡每一行的高度即可——高度连续变化时，
 * 后面的行会被布局连续推移，视觉上就是“跟着滑上去/滑下来”，和官方折叠一致的
 * 手感。
 *
 * 官方行自带上下内边距和外边距，只过渡 height 会让行在第一帧先被撑大、
 * 结束时又在切换 `display: none` 的瞬间跳一下。因此这里固定用 `border-box`
 * 量高，并把上下内边距、上外边距一起过渡到 0，整行是“真正缩没”的。
 */
const DURATION_MS = 180
const EASING = 'cubic-bezier(0.2, 0, 0, 1)'
const TRANSITION = [
  `height ${DURATION_MS}ms ${EASING}`,
  `padding-top ${DURATION_MS}ms ${EASING}`,
  `padding-bottom ${DURATION_MS}ms ${EASING}`,
  `margin-top ${DURATION_MS}ms ${EASING}`,
  `opacity ${DURATION_MS}ms ${EASING}`,
].join(', ')

interface RowState {
  /** 当前对外可见状态（动画结束后与 display 一致）。 */
  visible: boolean
  /** 进行中的动画计时器；0 表示空闲。 */
  timer: number
  /** 是否已经历过首次同步；首次同步直接落定，不播动画。 */
  initialized: boolean
}

const states = new WeakMap<HTMLElement, RowState>()
let activeAnimations = 0

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function clearAnimationStyles(element: HTMLElement): void {
  element.style.transition = ''
  element.style.height = ''
  element.style.opacity = ''
  element.style.overflow = ''
  element.style.boxSizing = ''
  element.style.paddingTop = ''
  element.style.paddingBottom = ''
  element.style.marginTop = ''
}

function settle(element: HTMLElement, state: RowState, visible: boolean): void {
  if (state.timer !== 0) {
    window.clearTimeout(state.timer)
    state.timer = 0
    activeAnimations -= 1
  }
  state.visible = visible
  clearAnimationStyles(element)
  element.style.display = visible ? '' : 'none'
}

/**
 * 让元素按 `visible` 显示或隐藏，变化过程带高度动画。
 * 重复调用安全：动画进行中再收到同一个目标状态会直接忽略。
 */
export function applyVisibility(element: HTMLElement, visible: boolean): void {
  let state = states.get(element)
  if (state === undefined) {
    state = { visible: element.style.display !== 'none', timer: 0, initialized: false }
    states.set(element, state)
  }
  // 首次见到这个元素时直接落定：刚创建的行、或启动时就折叠着的分组，
  // 不该播一次从有到无的动画。
  if (!state.initialized) {
    state.initialized = true
    settle(element, state, visible)
    return
  }
  if (state.visible === visible) return
  if (!element.isConnected || reducedMotion()) {
    settle(element, state, visible)
    return
  }
  if (state.timer !== 0) {
    window.clearTimeout(state.timer)
    state.timer = 0
    activeAnimations -= 1
  }

  // 先按自然状态量一次：盒高、上下内边距、上外边距都以它为准。
  clearAnimationStyles(element)
  element.style.display = ''
  const natural = element.getBoundingClientRect()
  const computed = getComputedStyle(element)
  const naturalPaddingTop = computed.paddingTop
  const naturalPaddingBottom = computed.paddingBottom
  const naturalMarginTop = computed.marginTop

  element.style.boxSizing = 'border-box'
  element.style.overflow = 'hidden'
  element.style.transition = 'none'
  element.style.height = `${natural.height}px`
  element.style.opacity = state.visible ? '1' : '0'
  // 读一次布局，确保起点已生效，否则过渡会被合并掉。
  void element.offsetHeight

  element.style.transition = TRANSITION
  if (visible) {
    element.style.paddingTop = naturalPaddingTop
    element.style.paddingBottom = naturalPaddingBottom
    element.style.marginTop = naturalMarginTop
    element.style.height = `${natural.height}px`
    element.style.opacity = '1'
  } else {
    element.style.paddingTop = '0px'
    element.style.paddingBottom = '0px'
    element.style.marginTop = '0px'
    element.style.height = '0px'
    element.style.opacity = '0'
  }

  state.visible = visible
  state.timer = window.setTimeout(() => settle(element, state!, visible), DURATION_MS + 20)
  activeAnimations += 1
}

/** 清除某个行上的动画状态，供清理列表时调用。 */
export function resetVisibility(element: HTMLElement): void {
  const state = states.get(element)
  if (state !== undefined) {
    if (state.timer !== 0) {
      window.clearTimeout(state.timer)
      state.timer = 0
      activeAnimations -= 1
    }
    states.delete(element)
  }
  clearAnimationStyles(element)
  element.style.display = ''
}
