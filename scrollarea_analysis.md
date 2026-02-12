# ScrollArea 分析

Popover wrapper height: 837px (超出屏幕)
PopoverContent height: 837px (没有 maxHeight 限制)
ScrollArea viewport height: 1085.5px (scrollHeight: 1086)
ScrollArea maxHeight: none (max-h-[70vh] 没有生效!)
ScrollArea overflow: hidden scroll (可以滚动)

问题：max-h-[70vh] 没有应用到 ScrollArea 的 viewport 上。
Radix ScrollArea 的 viewport 是一个内部元素，class 应用在外层容器上。
需要检查 ScrollArea 组件的实现，可能需要将 max-h 应用到正确的元素上。

解决方案：
1. 给 PopoverContent 添加 max-h 限制
2. 或者给 ScrollArea 的外层 div 添加固定高度
3. 最好的方式是给 PopoverContent 设置 max-h，让 ScrollArea 自动填充
