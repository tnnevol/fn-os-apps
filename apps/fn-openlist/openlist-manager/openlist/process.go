package openlist

import (
	"os"
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

func GetPID() (int, bool) {
	data, err := os.ReadFile(PidFile())
	if err != nil {
		return 0, false
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil || pid <= 0 {
		return 0, false
	}

	proc, err := os.FindProcess(pid)
	if err != nil {
		return 0, false
	}
	if err := proc.Signal(os.Signal(nil)); err != nil {
		os.Remove(PidFile())
		return 0, false
	}
	return pid, true
}

func Stop() error {
	pid, running := GetPID()
	if !running {
		return nil
	}

	proc, _ := os.FindProcess(pid)
	proc.Signal(os.Interrupt)

	for i := 0; i < 10; i++ {
		if proc.Signal(os.Signal(nil)) != nil {
			return nil
		}
	}

	proc.Kill()
	return nil
}

func Start() error {
	binPath := filepath.Join(ServerDir(), "openlist")

	cmd := exec.Command(binPath, "start", "--data", DataDir())
	cmd.Dir = ServerDir()

	if err := cmd.Start(); err != nil {
		return err
	}

	os.WriteFile(PidFile(), []byte(strconv.Itoa(cmd.Process.Pid)), 0644)
	return nil
}

func Restart() error {
	if err := Stop(); err != nil {
		return err
	}
	return Start()
}
