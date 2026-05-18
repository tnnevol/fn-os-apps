package openlist

import (
	"bytes"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

func Version() string {
	binPath := filepath.Join(ServerDir(), "openlist")
	cmd := exec.Command(binPath, "version")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(out))
}

func IsRunning() bool {
	cmd := exec.Command("pgrep", "-f", "openlist server.*--data.*"+DataDir())
	return cmd.Run() == nil
}

func GetPID() int {
	out, err := exec.Command("pgrep", "-f", "openlist server.*--data.*"+DataDir()).Output()
	if err != nil {
		return 0
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for _, line := range lines {
		if pid, err := strconv.Atoi(line); err == nil && pid > 0 {
			return pid
		}
	}
	return 0
}

func Stop() error {
	binPath := filepath.Join(ServerDir(), "openlist")
	cmd := exec.Command(binPath, "stop", "--data", DataDir())
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	_ = cmd.Run()
	return nil
}

func Start() error {
	binPath := filepath.Join(ServerDir(), "openlist")
	cmd := exec.Command(binPath, "server", "--data", DataDir())
	return cmd.Start()
}

func Restart() error {
	Stop()
	return Start()
}
