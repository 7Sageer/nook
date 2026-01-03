package main

// 版本信息变量，在编译时通过 -ldflags 注入
var (
	// Version 应用版本号，从 git tag 读取
	Version = "dev"
	// BuildTime 构建时间
	BuildTime = "unknown"
	// GitCommit Git 提交哈希
	GitCommit = "unknown"
)
