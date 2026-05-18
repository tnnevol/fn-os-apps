package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

const adminPort = "5245"

var (
	upgrading bool
	mu        sync.Mutex
)

type Status struct {
	Version    string `json:"version"`
	Running    bool   `json:"running"`
	PID        int    `json:"pid"`
	Upgrading  bool   `json:"upgrading"`
	DataDir    string `json:"data_dir"`
	ServerDir  string `json:"server_dir"`
}

func getServerDir() string {
	appDest := os.Getenv("TRIM_APPDEST")
	if appDest == "" {
		appDest = "/var/apps/fn-openlist/target"
	}
	return filepath.Join(appDest, "server")
}

func getDataDir() string {
	dataShares := os.Getenv("TRIM_DATA_SHARE_PATHS")
	if dataShares != "" {
		return strings.Split(dataShares, ":")[0]
	}
	return ""
}

func getVarDir() string {
	pkgVar := os.Getenv("TRIM_PKGVAR")
	if pkgVar == "" {
		pkgVar = "/var/apps/fn-openlist/var"
	}
	return pkgVar
}

func getOpenListVersion() string {
	serverDir := getServerDir()
	binPath := filepath.Join(serverDir, "openlist")
	cmd := exec.Command(binPath, "version")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(out))
}

func getOpenListPID() (int, bool) {
	pidFile := filepath.Join(getVarDir(), "app.pid")
	data, err := os.ReadFile(pidFile)
	if err != nil {
		return 0, false
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil || pid <= 0 {
		return 0, false
	}

	// Verify process exists
	proc, err := os.FindProcess(pid)
	if err != nil {
		return 0, false
	}
	// On Unix, FindProcess always succeeds, so check via signal
	err = proc.Signal(os.Signal(nil))
	if err != nil {
		os.Remove(pidFile)
		return 0, false
	}
	return pid, true
}

func stopOpenList() error {
	pid, running := getOpenListPID()
	if !running {
		return nil
	}

	proc, _ := os.FindProcess(pid)
	// Graceful stop
	proc.Signal(os.Interrupt)

	// Wait up to 10 seconds
	for i := 0; i < 10; i++ {
		if proc.Signal(os.Signal(nil)) != nil {
			return nil
		}
	}

	// Force kill
	proc.Kill()
	return nil
}

func startOpenList() error {
	serverDir := getServerDir()
	dataDir := getDataDir()
	binPath := filepath.Join(serverDir, "openlist")

	cmd := exec.Command(binPath, "server", "--port", "5244", "--data", dataDir)
	cmd.Dir = serverDir
	cmd.Stdout = nil
	cmd.Stderr = nil

	err := cmd.Start()
	if err != nil {
		return fmt.Errorf("start failed: %w", err)
	}

	// Write PID file
	pidFile := filepath.Join(getVarDir(), "app.pid")
	os.WriteFile(pidFile, []byte(strconv.Itoa(cmd.Process.Pid)), 0644)
	return nil
}

func doUpgrade(version string) error {
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

	serverDir := getServerDir()
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

	// Stop OpenList before replacing binary
	if err := stopOpenList(); err != nil {
		return fmt.Errorf("stop failed: %w", err)
	}

	// Extract
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

	// Restart OpenList
	if err := startOpenList(); err != nil {
		return fmt.Errorf("restart failed: %w", err)
	}

	return nil
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	pid, running := getOpenListPID()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Status{
		Version:   getOpenListVersion(),
		Running:   running,
		PID:       pid,
		Upgrading: upgrading,
		DataDir:   getDataDir(),
		ServerDir: getServerDir(),
	})
}

func handleUpgrade(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Version string `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	go func() {
		err := doUpgrade(req.Version)
		if err != nil {
			fmt.Fprintf(os.Stderr, "upgrade error: %v\n", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func handleLog(w http.ResponseWriter, r *http.Request) {
	logFile := filepath.Join(getVarDir(), "info.log")

	data, err := os.ReadFile(logFile)
	if err != nil {
		http.Error(w, "log not available", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write(data)
}

func handleRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	go func() {
		if err := stopOpenList(); err != nil {
			fmt.Fprintf(os.Stderr, "stop error: %v\n", err)
			return
		}
		if err := startOpenList(); err != nil {
			fmt.Fprintf(os.Stderr, "start error: %v\n", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "restarting"})
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	tmpl, err := template.ParseFiles("templates/index.html")
	if err != nil {
		http.Error(w, "template error", http.StatusInternalServerError)
		return
	}
	tmpl.Execute(w, nil)
}

func main() {
	http.HandleFunc("/", handleIndex)
	http.HandleFunc("/api/status", handleStatus)
	http.HandleFunc("/api/upgrade", handleUpgrade)
	http.HandleFunc("/api/log", handleLog)
	http.HandleFunc("/api/restart", handleRestart)

	fmt.Printf("Admin panel listening on :%s\n", adminPort)
	if err := http.ListenAndServe(":"+adminPort, nil); err != nil {
		fmt.Fprintf(os.Stderr, "admin panel error: %v\n", err)
		os.Exit(1)
	}
}
