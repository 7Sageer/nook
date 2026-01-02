package fileextract

import (
	"fmt"
	"runtime"
)

// getInstallHint 根据操作系统返回安装命令提示
func getInstallHint(tool string) string {
	var macCmd, linuxCmd, winCmd string

	switch tool {
	case "pdftotext":
		macCmd = "brew install poppler"
		linuxCmd = "sudo apt install poppler-utils"
		winCmd = "choco install poppler"
	case "pandoc":
		macCmd = "brew install pandoc"
		linuxCmd = "sudo apt install pandoc"
		winCmd = "choco install pandoc"
	default:
		return ""
	}

	switch runtime.GOOS {
	case "darwin":
		return fmt.Sprintf("  安装命令: %s", macCmd)
	case "linux":
		return fmt.Sprintf("  安装命令: %s", linuxCmd)
	case "windows":
		return fmt.Sprintf("  安装命令: %s", winCmd)
	default:
		return fmt.Sprintf("  macOS: %s\n  Linux: %s\n  Windows: %s", macCmd, linuxCmd, winCmd)
	}
}
