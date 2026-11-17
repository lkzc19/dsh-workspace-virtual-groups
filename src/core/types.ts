/**
 * dsh-workspace-virtual-groups 共享的手动分组类型。纯类型、零运行时依赖，
 * 让宿主侧（sidecar 持久化）和浏览器侧（树形推导）编译在同一份契约上。
 *
 * 分组只由用户创建；内置的「默认」分组承接所有没有显式归属的工作区。
 */

/** 侧边栏要呈现的分组视图模式。 */
export type GroupViewMode = 'virtual' | 'official'

/**
 * 运行时维护的分组叠加层：侧边栏里创建的分组、每个工作区的归属，以及用户
 * 控制的排序。由插件自己持有（JSON sidecar，
 * `$DSH_HOME/workspace-virtual-groups.manual.json`）。
 */
export interface ManualGroups {
  /** 手动创建的分组名，按创建顺序。 */
  categories: string[]
  /**
   * 每个工作区的分组归属，键为 workspace id。值为分组名；`null` 表示内置的
   * 默认分组。键缺失同样按默认分组处理。
   */
  assignments: Record<string, string | null>
  /**
   * 手动分组的显示顺序。「默认」分组固定在最前且从不出现在这里；缺省表示按
   * 创建顺序。同级分组按各自在此列表中的位置比较，因此一个扁平列表就能排好
   * 整棵树。
   */
  categoryOrder?: string[]
  /**
   * 嵌套关系：子分组名 → 父分组名。缺少条目表示该分组位于顶层，与内置的
   * 默认分组平级。
   *
   * 「默认」分组可以作为父级（它有自己的子树），但永远不会是子级，且始终
   * 排在最前。
   */
  parents?: Record<string, string>
  /**
   * 最近一次在官方视图选项里选择的模式。缺省按 `virtual` 处理。
   */
  mode?: GroupViewMode
}

/**
 * 内置且不可删除的分组，承接所有没有显式归属的工作区。按产品要求固定命名：
 * 在任何界面语言下都原样显示，且不允许重命名或删除。
 *
 * 持久化约定：归属值为 `null` 即表示「默认分组」。
 */
export const DEFAULT_GROUP = '默认'
