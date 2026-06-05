'use client';

import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from 'react';

type ExpandableTextProps = {
  children: ReactNode;
  /** 折叠时的最大高度（px），建议取 line-height 的整数倍（如 240 = 10 × 24），避免文字被拦腰截断 */
  maxHeight?: number;
  /** 卡片背景色（CSS 颜色字符串，如 'rgb(255, 255, 255)'），通过 CSS 变量 --card-bg-color 传递到遮罩 */
  maskColor: string;
};

/**
 * 长文本截断 + 渐变遮罩展开/收起
 * - 折叠：max-height 截断，底部 60px 渐变遮罩作为"展开"点击热区
 *   - 渐变：透明 0% → 卡片背景色 70% → 卡片背景色 100%（底部 30% 为完全不透明实色）
 *   - "展开"按钮固定在底部 30% 实色区域正中央，彻底避开文字
 * - 展开：内容完整显示，文本下方居中"收起"按钮
 * - 内容未超过 maxHeight 时不显示任何截断/按钮
 */
export default function ExpandableText({ children, maxHeight = 240, maskColor }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 测量真实内容高度（不受当前 maxHeight 影响）
    const prevMaxHeight = el.style.maxHeight;
    el.style.maxHeight = 'none';
    const contentHeight = el.scrollHeight;
    el.style.maxHeight = prevMaxHeight;
    setOverflows(contentHeight > maxHeight + 1);
  }, [children, maxHeight, expanded]);

  const cssVars = { '--card-bg-color': maskColor } as CSSProperties;

  return (
    <div className="relative" style={cssVars}>
      <div
        ref={ref}
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: expanded ? 'none' : `${maxHeight}px` }}
      >
        {children}
      </div>
      {overflows && !expanded && (
        <div className="absolute left-0 right-0 bottom-0 h-[60px] pointer-events-none">
          {/* 渐变遮罩：顶部透明，70% 起为卡片背景色实色 */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, transparent 0%, var(--card-bg-color) 50%, var(--card-bg-color) 100%)',
            }}
          />
          {/* 展开按钮：固定在底部 30% 实色区域正中央 */}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute left-0 right-0 bottom-0 h-[30%] flex items-center justify-center cursor-pointer border-0 bg-transparent pointer-events-auto"
            aria-label="展开"
          >
            <span className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 text-xs font-medium">
              展开
              <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
            </span>
          </button>
        </div>
      )}
      {overflows && expanded && (
        <div className="flex justify-center mt-2">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 text-xs font-medium bg-transparent border-0 cursor-pointer"
            aria-label="收起"
          >
            收起
            <span className="material-symbols-outlined text-[16px]">keyboard_arrow_up</span>
          </button>
        </div>
      )}
    </div>
  );
}
