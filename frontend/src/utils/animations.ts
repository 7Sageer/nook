import { Variants, Transition } from 'framer-motion';

/**
 * 共享动画配置
 * 统一管理 Framer Motion 动画变量，避免重复定义
 */

// ========== 缓动函数 ==========
export const easings = {
    // 标准缓动 - 用于大多数动画
    standard: [0.4, 0, 0.2, 1] as const,
    // 退出缓动 - 用于元素离开
    exit: [0.4, 0, 1, 1] as const,
    // 弹性缓动 - 用于强调效果
    bounce: [0.34, 1.56, 0.64, 1] as const,
    // dnd-kit 推荐的缓动
    dndKit: [0.2, 0, 0, 1] as const,
};

// ========== 时长常量 ==========
export const durations = {
    fast: 0.15,
    normal: 0.2,
    slow: 0.3,
    stagger: 0.03, // 列表项错开延迟
};

// ========== 列表项动画 ==========
// 用于文档列表和文件夹内文档的进入/退出动画
export const listItemVariants: Variants = {
    initial: {
        opacity: 0,
        x: -12,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
    },
    animate: ({
        index,
        isActive,
        staggerIndex,
    }: {
        index: number;
        isActive?: boolean;
        staggerIndex?: number;
    }) => ({
        opacity: 1,
        x: isActive ? 4 : 0,
        height: 36,
        marginTop: undefined, // 恢复默认
        marginBottom: 2, // 恢复 CSS 中定义的值
        paddingTop: 10,
        paddingBottom: 10,
        transition: {
            delay: (staggerIndex ?? index) * durations.stagger,
            duration: durations.normal,
            ease: easings.standard,
            // 高度先展开，再淡入
            height: { duration: durations.fast },
            paddingTop: { duration: durations.fast },
            paddingBottom: { duration: durations.fast },
            marginBottom: { duration: durations.fast },
        },
    }),
    exit: {
        opacity: 0,
        x: -20,
        scale: 0.95,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
        transition: {
            duration: durations.normal,
            ease: easings.standard,
            // 让视觉效果（opacity, x, scale）先完成
            opacity: { duration: durations.fast },
            x: { duration: durations.fast },
            scale: { duration: durations.fast },
        },
    },
};

// ========== 拖拽相关配置 ==========
// dnd-kit sortable 的过渡配置
export const sortableTransition: Transition = {
    duration: 0.2,
    ease: easings.dndKit,
};

// 拖拽时禁用 layout 动画的配置
export const dragLayoutTransition = {
    layout: {
        duration: 0,
    },
};

// ========== 工具函数 ==========
/**
 * 获取列表项的动画 props
 * @param index - 列表项索引，用于计算错开延迟
 * @param isDragging - 是否正在拖拽，拖拽时禁用某些动画
 */
export function getListItemAnimationProps(index: number, isDragging: boolean = false) {
    return {
        variants: listItemVariants,
        initial: 'initial',
        animate: 'animate',
        exit: 'exit',
        custom: { index },
        // 拖拽时禁用 layout 动画，避免与 dnd-kit transform 冲突
        layout: !isDragging,
        layoutId: undefined, // 明确不使用 layoutId
        transition: isDragging ? dragLayoutTransition : undefined,
    };
}
