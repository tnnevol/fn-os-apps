package openlist

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
)

var (
	upgrading bool
	mu        sync.Mutex
)

func IsUpgrading() bool {
	mu.Lock()
	defer mu.Unlock()
	return upgrading
}

func Upgrade(version string) error {
	mu.Lock()
	if upgrading {
		mu.Unlock()
		return fmt.Errorf("upgrade in progress")
	}
	upgrading = true
	mu.Unlock()
	defer func() {
		mu.Lock()
		upgrading = false
		mu.Unlock()
	}()

	serverDir := ServerDir()
	os.MkdirAll(serverDir, 0755)

	var url string
	if version == "latest" || version == "" {
		url = "https://github.com/OpenListTeam/OpenList/releases/latest/download/openlist-linux-amd64.tar.gz"
	} else {
		url = fmt.Sprintf("https://github.com/OpenListTeam/OpenList/releases/download/v%s/openlist-linux-amd64.tar.gz", version)
	}

	tarFile := "/tmp/openlist-upgrade.tar.gz"

	dlCmd := exec.Command("curl", "-fsSL", "-o", tarFile, url)
	if out, err := dlCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("download failed: %s (%s)", err, string(out))
	}

	if err := Stop(); err != nil {
		return fmt.Errorf("stop failed: %w", err)
	}

	extCmd := exec.Command("tar", "-xzf", tarFile, "-C", serverDir, "openlist")
	if err := extCmd.Run(); err != nil {
		extCmd = exec.Command("tar", "-xzf", tarFile, "-C", serverDir)
		if err := extCmd.Run(); err != nil {
			os.Remove(tarFile)
			return fmt.Errorf("extract failed: %w", err)
		}
	}
	os.Remove(tarFile)

	binPath := filepath.Join(serverDir, "openlist")
	os.Chmod(binPath, 0755)

	if err := Start(); err != nil {
		return fmt.Errorf("restart failed: %w", err)
	}

	return nil
}
