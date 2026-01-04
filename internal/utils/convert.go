package utils

// ConvertSlice 将一个切片转换为另一个类型的切片
// 使用泛型减少样板代码
func ConvertSlice[From, To any](items []From, convert func(From) To) []To {
	if items == nil {
		return nil
	}
	result := make([]To, len(items))
	for i, item := range items {
		result[i] = convert(item)
	}
	return result
}

// ConvertSliceWithIndex 带索引的切片转换
// 适用于转换函数需要知道元素索引的场景
func ConvertSliceWithIndex[From, To any](items []From, convert func(int, From) To) []To {
	if items == nil {
		return nil
	}
	result := make([]To, len(items))
	for i, item := range items {
		result[i] = convert(i, item)
	}
	return result
}

// FilterSlice 过滤切片，返回满足条件的元素
func FilterSlice[T any](items []T, predicate func(T) bool) []T {
	if items == nil {
		return nil
	}
	result := make([]T, 0)
	for _, item := range items {
		if predicate(item) {
			result = append(result, item)
		}
	}
	return result
}

// MapSlice 是 ConvertSlice 的别名，更符合函数式编程习惯
func MapSlice[From, To any](items []From, mapper func(From) To) []To {
	return ConvertSlice(items, mapper)
}
