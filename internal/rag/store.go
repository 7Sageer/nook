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
	DocID          string    // 所属文档 ID
	Content        string    // 块的纯文本内容
	ContentHash    string    // 内容哈希（用于去重）
	BlockType      string    // paragraph, heading, list 等
	HeadingContext string    // 最近的 heading 文本
	Embedding      []float32 // 向量
}

// SearchResult 搜索结果
type SearchResult struct {
	BlockID        string  `json:"blockId"`
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
		db.Close()
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

	// 添加新列（如果不存在）
	s.db.Exec(`ALTER TABLE block_vectors ADD COLUMN content_hash TEXT`)
	s.db.Exec(`ALTER TABLE block_vectors ADD COLUMN heading_context TEXT`)

	// 创建 sqlite-vec 虚拟表
	query := fmt.Sprintf(`
		CREATE VIRTUAL TABLE IF NOT EXISTS vec_blocks USING vec0(
			id TEXT PRIMARY KEY,
			embedding FLOAT[%d]
		);
	`, s.dimension)
	_, err = s.db.Exec(query)
	return err
}

// Upsert 插入或更新块向量
func (s *VectorStore) Upsert(block *BlockVector) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 更新元数据（包含 content_hash 和 heading_context）
	_, err = tx.Exec(`
		INSERT OR REPLACE INTO block_vectors (id, doc_id, content, content_hash, block_type, heading_context)
		VALUES (?, ?, ?, ?, ?, ?)
	`, block.ID, block.DocID, block.Content, block.ContentHash, block.BlockType, block.HeadingContext)
	if err != nil {
		return err
	}

	// 更新向量
	vecBytes := serializeVector(block.Embedding)
	_, err = tx.Exec(`
		INSERT OR REPLACE INTO vec_blocks (id, embedding)
		VALUES (?, ?)
	`, block.ID, vecBytes)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetBlockHashes 获取文档所有块的哈希映射
func (s *VectorStore) GetBlockHashes(docID string) (map[string]string, error) {
	rows, err := s.db.Query(`SELECT id, content_hash FROM block_vectors WHERE doc_id = ?`, docID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hashes := make(map[string]string)
	for rows.Next() {
		var id string
		var hash sql.NullString
		if err := rows.Scan(&id, &hash); err != nil {
			return nil, err
		}
		if hash.Valid {
			hashes[id] = hash.String
		}
	}
	return hashes, nil
}

// DeleteBlocks 删除指定的块
func (s *VectorStore) DeleteBlocks(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, id := range ids {
		tx.Exec("DELETE FROM vec_blocks WHERE id = ?", id)
		tx.Exec("DELETE FROM block_vectors WHERE id = ?", id)
	}

	return tx.Commit()
}

// HashContent 计算内容的 SHA256 哈希
func HashContent(content string) string {
	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:])[:16] // 只取前 16 字符
}

// DeleteByDocID 删除文档的所有块向量
func (s *VectorStore) DeleteByDocID(docID string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 获取要删除的 block IDs
	rows, err := tx.Query("SELECT id FROM block_vectors WHERE doc_id = ?", docID)
	if err != nil {
		return err
	}
	var ids []string
	for rows.Next() {
		var id string
		rows.Scan(&id)
		ids = append(ids, id)
	}
	rows.Close()

	// 删除向量和元数据
	for _, id := range ids {
		tx.Exec("DELETE FROM vec_blocks WHERE id = ?", id)
		tx.Exec("DELETE FROM block_vectors WHERE id = ?", id)
	}

	return tx.Commit()
}

// Search 向量相似度搜索
func (s *VectorStore) Search(queryVec []float32, limit int) ([]SearchResult, error) {
	vecBytes := serializeVector(queryVec)
	rows, err := s.db.Query(`
		SELECT v.id, v.distance, b.doc_id, b.content, b.block_type, COALESCE(b.heading_context, '')
		FROM vec_blocks v
		JOIN block_vectors b ON v.id = b.id
		WHERE v.embedding MATCH ? AND k = ?
		ORDER BY v.distance
	`, vecBytes, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		if err := rows.Scan(&r.BlockID, &r.Distance, &r.DocID, &r.Content, &r.BlockType, &r.HeadingContext); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}

// Close 关闭数据库连接
func (s *VectorStore) Close() error {
	return s.db.Close()
}

// GetIndexedDocCount 获取已索引的文档数量
func (s *VectorStore) GetIndexedDocCount() (int, error) {
	var count int
	err := s.db.QueryRow(`SELECT COUNT(DISTINCT doc_id) FROM block_vectors WHERE block_type != 'bookmark'`).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// GetIndexedStats 获取索引统计信息 (文档数, 书签数)
func (s *VectorStore) GetIndexedStats() (int, int, error) {
	var docCount int
	err := s.db.QueryRow(`SELECT COUNT(DISTINCT doc_id) FROM block_vectors WHERE block_type != 'bookmark'`).Scan(&docCount)
	if err != nil {
		return 0, 0, err
	}

	var bookmarkCount int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM block_vectors WHERE block_type = 'bookmark'`).Scan(&bookmarkCount)
	if err != nil {
		return 0, 0, err
	}

	return docCount, bookmarkCount, nil
}

// GetAllDocIDs 获取所有已索引的文档 ID
func (s *VectorStore) GetAllDocIDs() ([]string, error) {
	rows, err := s.db.Query(`SELECT DISTINCT doc_id FROM block_vectors`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docIDs []string
	for rows.Next() {
		var docID string
		if err := rows.Scan(&docID); err != nil {
			return nil, err
		}
		docIDs = append(docIDs, docID)
	}
	return docIDs, nil
}

// serializeVector 将 float32 切片序列化为字节
func serializeVector(vec []float32) []byte {
	buf := make([]byte, len(vec)*4)
	for i, v := range vec {
		binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(v))
	}
	return buf
}
