package rag

import (
	"crypto/sha256"
	"database/sql"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"math"

	sqlite_vec "github.com/asg017/sqlite-vec-go-bindings/cgo"
	_ "github.com/mattn/go-sqlite3"
)

func init() {
	sqlite_vec.Auto()
}

// BlockVector 块向量记录
type BlockVector struct {
	ID             string    // block_id
	SourceBlockID  string    // 原始块 ID（用于定位，对于合并/聚合块，保存第一个原始块 ID）
	DocID          string    // 所属文档 ID
	Content        string    // 块的纯文本内容
	ContentHash    string    // 内容哈希（用于去重）
	BlockType      string    // paragraph, heading, list 等
	HeadingContext string    // 最近的 heading 文本
	FilePath       string    // 文件路径（仅 file 类型块使用）
	Embedding      []float32 // 向量
}

// SearchResult 搜索结果
type SearchResult struct {
	BlockID        string  `json:"blockId"`
	SourceBlockID  string  `json:"sourceBlockId"` // 原始块 ID（用于定位）
	DocID          string  `json:"docId"`
	Content        string  `json:"content"`
	BlockType      string  `json:"blockType"`
	HeadingContext string  `json:"headingContext"`
	Distance       float32 `json:"distance"`
}

// VectorStore 向量存储接口
type VectorStore struct {
	db        *sql.DB
	dimension int
}

// NewVectorStore 创建向量存储
func NewVectorStore(dbPath string, dimension int) (*VectorStore, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	store := &VectorStore{db: db, dimension: dimension}
	if err := store.initSchema(); err != nil {
		_ = db.Close() // 忽略 Close 错误
		return nil, fmt.Errorf("failed to init schema: %w", err)
	}
	return store, nil
}

func (s *VectorStore) initSchema() error {
	// 创建元数据表
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS block_vectors (
			id TEXT PRIMARY KEY,
			doc_id TEXT NOT NULL,
			content TEXT NOT NULL,
			content_hash TEXT,
			block_type TEXT,
			heading_context TEXT,
			updated_at INTEGER DEFAULT (strftime('%s', 'now'))
		);
		CREATE INDEX IF NOT EXISTS idx_block_doc_id ON block_vectors(doc_id);
	`)
	if err != nil {
		return err
	}

	// 创建配置表（存储维度等元信息）
	_, err = s.db.Exec(`
		CREATE TABLE IF NOT EXISTS vec_config (
			key TEXT PRIMARY KEY,
			value TEXT
		)
	`)
	if err != nil {
		return err
	}

	// 检查已存储的维度是否与当前模型匹配
	var storedDimStr string
	row := s.db.QueryRow("SELECT value FROM vec_config WHERE key = 'dimension'")
	if err := row.Scan(&storedDimStr); err == nil {
		var storedDim int
		_, _ = fmt.Sscanf(storedDimStr, "%d", &storedDim)
		if storedDim > 0 && storedDim != s.dimension {
			// 维度不匹配，需要重建向量表
			fmt.Printf("⚠️ [RAG] Dimension mismatch: stored=%d, model=%d. Rebuilding vector index...\n", storedDim, s.dimension)
			_, _ = s.db.Exec("DROP TABLE IF EXISTS vec_blocks")
			_, _ = s.db.Exec("DELETE FROM block_vectors") // 清理元数据
		}
	}

	// 添加新列（如果不存在，忽略错误）
	_, _ = s.db.Exec(`ALTER TABLE block_vectors ADD COLUMN content_hash TEXT`)
	_, _ = s.db.Exec(`ALTER TABLE block_vectors ADD COLUMN heading_context TEXT`)
	_, _ = s.db.Exec(`ALTER TABLE block_vectors ADD COLUMN source_block_id TEXT`)
	_, _ = s.db.Exec(`ALTER TABLE block_vectors ADD COLUMN file_path TEXT`)

	// 创建 sqlite-vec 虚拟表（使用余弦距离，更适合文本相似度）
	query := fmt.Sprintf(`
		CREATE VIRTUAL TABLE IF NOT EXISTS vec_blocks USING vec0(
			id TEXT PRIMARY KEY,
			embedding FLOAT[%d] distance_metric=cosine
		);
	`, s.dimension)
	_, err = s.db.Exec(query)
	if err != nil {
		return err
	}

	// 保存当前维度到配置表
	_, err = s.db.Exec("INSERT OR REPLACE INTO vec_config (key, value) VALUES ('dimension', ?)", fmt.Sprintf("%d", s.dimension))
	return err
}

// Close 关闭数据库连接
func (s *VectorStore) Close() error {
	return s.db.Close()
}

// HashContent 计算内容的 SHA256 哈希
func HashContent(content string) string {
	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:])[:16] // 只取前 16 字符
}

// serializeVector 将 float32 切片序列化为字节
func serializeVector(vec []float32) []byte {
	buf := make([]byte, len(vec)*4)
	for i, v := range vec {
		binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(v))
	}
	return buf
}
