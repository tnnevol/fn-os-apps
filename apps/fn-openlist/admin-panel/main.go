package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

const adminPort = "5245"

var (
	installing bool
	mu         sync.Mutex
)

type Status struct {
	Version     string `json:"version"`
	Running     bool   `json:"running"`
	Installing  bool   `json:"installing"`
	DataDir     string `json:"data_dir"`
	ServerBin   string `json:"server_bin"`
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

func getOpenListVersion() string {
	serverDir := getServerDir()
	binPath := filepath.Join(serverDir, "openlist")
	cmd := exec.Command(binPath, "--version")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(out))
}

func isRunning() bool {
	pkgVar := os.Getenv("TRIM_PKGVAR")
	if pkgVar == "" {
		pkgVar = "/var/apps/fn-openlist/var"
	}
	pidFile := filepath.Join(pkgVar, "app.pid")

	data, err := os.ReadFile(pidFile)
	if err != nil {
		return false
	}
	pid := strings.TrimSpace(string(data))
	if pid == "" {
		return false
	}

	cmd := exec.Command("kill", "-0", pid)
	return cmd.Run() == nil
}

func doUpgrade(version string) error {
	mu.Lock()
	if installing {
		mu.Unlock()
		return fmt.Errorf("upgrade in progress")
	}
	installing = true
	mu.Unlock()
	defer func() {
		mu.Lock()
		installing = false
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

	// Download using curl
	tarFile := "/tmp/openlist-upgrade.tar.gz"
	dlCmd := exec.Command("curl", "-fsSL", "-o", tarFile, url)
	if out, err := dlCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("download failed: %s (%s)", err, string(out))
	}

	// Extract
	extCmd := exec.Command("tar", "-xzf", tarFile, "-C", serverDir, "openlist")
	if err := extCmd.Run(); err != nil {
		// Try without path filter
		extCmd = exec.Command("tar", "-xzf", tarFile, "-C", serverDir)
		if err := extCmd.Run(); err != nil {
			os.Remove(tarFile)
			return fmt.Errorf("extract failed: %s", err)
		}
	}
	os.Remove(tarFile)

	// Make executable
	binPath := filepath.Join(serverDir, "openlist")
	os.Chmod(binPath, 0755)

	// Restart OpenList (send signal to main script)
	pkgVar := os.Getenv("TRIM_PKGVAR")
	if pkgVar == "" {
		pkgVar = "/var/apps/fn-openlist/var"
	}
	pidFile := filepath.Join(pkgVar, "app.pid")
	data, err := os.ReadFile(pidFile)
	if err == nil {
		pid := strings.TrimSpace(string(data))
		if pid != "" {
			exec.Command("kill", "-TERM", pid).Run()
		}
	}

	return nil
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	status := Status{
		Version:    getOpenListVersion(),
		Running:    isRunning(),
		Installing: installing,
		DataDir:    getDataDir(),
		ServerBin:  getServerDir(),
	}
	json.NewEncoder(w).Encode(status)
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
	pkgVar := os.Getenv("TRIM_PKGVAR")
	if pkgVar == "" {
		pkgVar = "/var/apps/fn-openlist/var"
	}
	logFile := filepath.Join(pkgVar, "info.log")

	data, err := os.ReadFile(logFile)
	if err != nil {
		http.Error(w, "log not available", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write(data)
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

	fmt.Printf("Admin panel listening on :%s\n", adminPort)
	if err := http.ListenAndServe(":"+adminPort, nil); err != nil {
		fmt.Fprintf(os.Stderr, "admin panel error: %v\n", err)
		os.Exit(1)
	}
}
