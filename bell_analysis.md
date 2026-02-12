# 铃铛闪烁分析

## 当前实现
- Span 0 (闪烁层): animate-ping 动画正在运行 (animation: 1s ping infinite running)
- Span 1 (数字层): 静态显示，无动画

## 问题分析
animate-ping 动画确实在运行，但问题在于：
1. `animate-ping` 的默认效果是元素从正常大小扩大到更大然后消失，这是一个"扩散"效果
2. 由于 `opacity-75` 和 ping 动画本身的 opacity 变化，实际可见性很低（当前 opacity 只有 0.017）
3. 在深色背景上，红色的 ping 扩散效果可能不够明显
4. 用户可能期望的是铃铛本身在闪烁/摇晃，而不仅仅是红点的脉冲扩散

## 解决方案
1. 给铃铛图标本身添加摇晃动画（shake/wiggle），让用户更容易注意到
2. 增强红点的闪烁效果 - 使用 animate-pulse 替代 animate-ping，或自定义更明显的闪烁
3. 给数字标记也添加脉冲动画
4. 添加发光效果（glow）让红点更醒目

## 通知面板问题
1. 展开长文案后面板没有正确滚动 - 内容溢出
2. 需要确保 ScrollArea 的 max-h 足够且可滚动
