import { computed, reactive } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { useMainStore, useSlidesStore } from '@/store'
import type { PPTElement } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import { canUngroupElement } from '@/utils/element'

/** 마지막으로 그룹 해제한 요소들 — PPT '재그룹' 용 */
export const lastUngroup = reactive({ ids: [] as string[] })

export default () => {
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { activeElementIdList, activeElementList } = storeToRefs(mainStore)
  const { currentSlide } = storeToRefs(slidesStore)

  const { addHistorySnapshot } = useHistorySnapshot()

  /**
   * 判断当前选中的元素是否可以组合
   */
  const canCombine = computed(() => {
    if (activeElementList.value.length < 2) return false

    const firstGroupId = activeElementList.value[0].groupId
    if (!firstGroupId) return true

    const inSameGroup = activeElementList.value.every(el => (el.groupId && el.groupId) === firstGroupId)
    return !inSameGroup
  })

  /** 그룹 해제 가능 — 한 그룹만 골랐고, 해제 잠금(마코디 카드 이미지+링크)만 남은 게 아닐 때 */
  const canUncombine = computed(() => !canCombine.value && activeElementList.value.some(canUngroupElement))

  /**
   * 组合当前选中的元素：给当前选中的元素赋予一个相同的分组ID
   */
  const combineElements = () => {
    if (!activeElementList.value.length) return

    // 生成一个新元素列表进行后续操作
    let newElementList: PPTElement[] = JSON.parse(JSON.stringify(currentSlide.value.elements))

    // 生成分组ID
    const groupId = nanoid(10)

    // 收集需要组合的元素列表，并赋上唯一分组ID
    const combineElementList: PPTElement[] = []
    for (const element of newElementList) {
      if (activeElementIdList.value.includes(element.id)) {
        // 이미 그룹이면 안쪽 그룹으로 기억해 두었다가, 해제할 때 그대로 되살린다(그룹 안의 그룹)
        if (element.groupId) element.groupStack = [...(element.groupStack || []), element.groupId]
        element.groupId = groupId
        combineElementList.push(element)
      }
    }

    // 确保该组合内所有元素成员的层级是连续的，具体操作方法为：
    // 先获取到该组合内最上层元素的层级，将本次需要组合的元素从新元素列表中移除，
    // 再根据最上层元素的层级位置，将上面收集到的需要组合的元素列表一起插入到新元素列表中合适的位置
    const combineElementMaxLevel = newElementList.findIndex(_element => _element.id === combineElementList[combineElementList.length - 1].id)
    const combineElementIdList = combineElementList.map(_element => _element.id)
    newElementList = newElementList.filter(_element => !combineElementIdList.includes(_element.id))

    const insertLevel = combineElementMaxLevel - combineElementList.length + 1
    newElementList.splice(insertLevel, 0, ...combineElementList)

    slidesStore.updateSlide({ elements: newElementList })
    addHistorySnapshot()
  }

  /**
   * 取消组合元素：移除选中元素的分组ID
   */
  const uncombineElements = () => {
    if (!activeElementList.value.length) return
    // 고른 그룹(바깥 그룹) 단위로 푼다 — 일부만 선택돼 있어도 그룹 전체가 함께 풀림
    const targetGroupIds = new Set(activeElementList.value.filter(canUngroupElement).map(el => el.groupId))
    if (!targetGroupIds.size) return
    
    const newElementList: PPTElement[] = JSON.parse(JSON.stringify(currentSlide.value.elements))
    const memberIds: string[] = []
    for (const element of newElementList) {
      if (!targetGroupIds.has(element.groupId) || !canUngroupElement(element)) continue
      memberIds.push(element.id)
      // 바깥 그룹만 풀고 안쪽 그룹은 유지
      const inner = element.groupStack?.pop()
      if (element.groupStack && !element.groupStack.length) delete element.groupStack
      if (inner) element.groupId = inner
      else delete element.groupId
    }
    slidesStore.updateSlide({ elements: newElementList })

    // PPT 처럼 풀린 요소들은 선택된 채로 둔다
    mainStore.setActiveElementIdList(memberIds)
    lastUngroup.ids = memberIds

    addHistorySnapshot()
  }

  return {
    canCombine,
    canUncombine,
    combineElements,
    uncombineElements,
  }
}