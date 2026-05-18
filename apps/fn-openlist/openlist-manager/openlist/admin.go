package openlist

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"os/exec"
	"path/filepath"
	"strings"
)

func AdminInfo() (string, error) {
	binPath := filepath.Join(ServerDir(), "openlist")
	cmd := exec.Command(binPath, "admin")
	cmd.Dir = ServerDir()
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed: %s", string(out))
	}
	return strings.TrimSpace(string(out)), nil
}

func ResetPassword() (string, error) {
	binPath := filepath.Join(ServerDir(), "openlist")
	password := randomPassword(12)

	cmd := exec.Command(binPath, "admin", "set", password)
	cmd.Dir = ServerDir()
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed: %s", string(out))
	}
	return password, nil
}

func randomPassword(n int) string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
	b := make([]byte, n)
	for i := range b {
		idx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		b[i] = chars[idx.Int64()]
	}
	return string(b)
}
