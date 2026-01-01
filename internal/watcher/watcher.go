package watcher

import (
	"context"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// FileChangeEvent 文件变更事件
type FileChangeEvent struct {
	Type    string `json:"type"`    // "create", "write", "remove", "rename"
	Path    string `json:"path"`    // 文件路径
	IsIndex bool   `json:"isIndex"` // 是否为索引文件
	DocID   string `json:"docId"`   // 文档 ID（如果是文档文件）
}

// Service 文件监听服务
type Service struct {
	dataPath      string
	watcher       *fsnotify.Watcher
	ctx           context.Context
	cancel        context.CancelFunc
	debounceDelay time.Duration
	ignoreWindow  time.Duration // 忽略自己写入的时间窗口

	// 防抖相关
	mu            sync.Mutex
	pendingEvents map[string]*FileChangeEvent
	debounceTimer *time.Timer

	// 追踪应用自己的写入，避免触发自己的事件
	recentWrites map[string]time.Time

	// Callbacks
	OnDocumentChanged func(event FileChangeEvent)
}

// NewService 创建文件监听服务
func NewService(dataPath string) (*Service, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	return &Service{
		dataPath:      dataPath,
		watcher:       watcher,
		debounceDelay: 300 * time.Millisecond,
		ignoreWindow:  2 * time.Second, // 2秒内的事件视为自己触发（需要足够长以覆盖防抖延迟）
		pendingEvents: make(map[string]*FileChangeEvent),
		recentWrites:  make(map[string]time.Time),
	}, nil
}

// MarkWrite 标记文件为应用自己写入（供外部调用）
func (s *Service) MarkWrite(filePath string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.recentWrites[filePath] = time.Now()
}

// isRecentWrite 检查文件是否是应用最近写入的
func (s *Service) isRecentWrite(filePath string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	writeTime, exists := s.recentWrites[filePath]
	if !exists {
		return false
	}

	// 如果超过忽略窗口，删除记录并返回 false
	if time.Since(writeTime) > s.ignoreWindow {
		delete(s.recentWrites, filePath)
		return false
	}

	// 在忽略窗口内，返回 true（不删除记录，因为可能有多个事件）
	return true
}

// Start 启动文件监听
func (s *Service) Start(ctx context.Context) error {
	s.ctx = ctx
	watchCtx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	// 监听 documents 目录
	docsPath := filepath.Join(s.dataPath, "documents")
	if err := s.watcher.Add(docsPath); err != nil {
		runtime.LogError(ctx, "Failed to watch documents directory: "+err.Error())
		return err
	}
	runtime.LogInfo(ctx, "File watcher: watching "+docsPath)

	// 监听数据根目录（用于 index.json 变化）
	// fsnotify 更适合监听目录而不是单个文件
	if err := s.watcher.Add(s.dataPath); err != nil {
		runtime.LogWarning(ctx, "Failed to watch data directory: "+err.Error())
	} else {
		runtime.LogInfo(ctx, "File watcher: watching "+s.dataPath)
	}

	// 启动事件处理 goroutine
	go s.handleEvents(watchCtx)

	runtime.LogInfo(ctx, "File watcher started successfully")
	return nil
}

// Stop 停止文件监听
func (s *Service) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
	if s.watcher != nil {
		if err := s.watcher.Close(); err != nil {
			// 记录错误但不中断
			if s.ctx != nil {
				runtime.LogWarning(s.ctx, "Failed to close watcher: "+err.Error())
			}
		}
	}
}

// handleEvents 处理文件系统事件
func (s *Service) handleEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-s.watcher.Events:
			if !ok {
				return
			}
			s.processEvent(event)
		case err, ok := <-s.watcher.Errors:
			if !ok {
				return
			}
			runtime.LogError(s.ctx, "File watcher error: "+err.Error())
		}
	}
}

// processEvent 处理单个事件
func (s *Service) processEvent(event fsnotify.Event) {
	// 只处理 JSON 文件
	if !strings.HasSuffix(event.Name, ".json") {
		return
	}

	// 忽略应用自己的写入
	if s.isRecentWrite(event.Name) {
		runtime.LogDebug(s.ctx, "File watcher: ignoring self-triggered event for "+event.Name)
		return
	}

	runtime.LogDebug(s.ctx, "File watcher received external event: "+event.String())

	// 判断事件类型
	var eventType string
	switch {
	case event.Has(fsnotify.Create):
		eventType = "create"
	case event.Has(fsnotify.Write):
		eventType = "write"
	case event.Has(fsnotify.Remove):
		eventType = "remove"
	case event.Has(fsnotify.Rename):
		eventType = "rename"
	default:
		return // 忽略其他事件
	}

	// 构建变更事件
	isIndex := strings.HasSuffix(event.Name, "index.json")
	docID := ""
	if !isIndex {
		// 从文件名提取文档 ID
		baseName := filepath.Base(event.Name)
		docID = strings.TrimSuffix(baseName, ".json")
	}

	changeEvent := &FileChangeEvent{
		Type:    eventType,
		Path:    event.Name,
		IsIndex: isIndex,
		DocID:   docID,
	}

	// 添加到待处理事件（防抖）
	s.mu.Lock()
	defer s.mu.Unlock()

	// 使用路径作为 key，覆盖之前的事件
	s.pendingEvents[event.Name] = changeEvent

	// 重置防抖定时器
	if s.debounceTimer != nil {
		s.debounceTimer.Stop()
	}
	s.debounceTimer = time.AfterFunc(s.debounceDelay, s.flushEvents)
}

// flushEvents 发送所有待处理的事件
func (s *Service) flushEvents() {
	s.mu.Lock()
	events := make([]*FileChangeEvent, 0, len(s.pendingEvents))
	for _, e := range s.pendingEvents {
		events = append(events, e)
	}
	s.pendingEvents = make(map[string]*FileChangeEvent)
	s.mu.Unlock()

	if s.ctx == nil {
		return
	}

	// 按类型发送事件
	for _, e := range events {
		if e.IsIndex {
			runtime.LogInfo(s.ctx, "File watcher emitting: file:index-changed")
			runtime.EventsEmit(s.ctx, "file:index-changed", e)
		} else {
			runtime.LogInfo(s.ctx, "File watcher emitting: file:document-changed for "+e.DocID)
			runtime.EventsEmit(s.ctx, "file:document-changed", e)

			// 触发回调 (用于更新后端 Search Index)
			if s.OnDocumentChanged != nil {
				s.OnDocumentChanged(*e)
			}
		}
	}
}
