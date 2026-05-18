package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"os"

	"openlist-manager/openlist"
)

const adminPort = "5245"

func handleStatus(w http.ResponseWriter, r *http.Request) {
	pid := openlist.GetPID()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"version":    openlist.Version(),
		"running":    pid > 0,
		"pid":        pid,
		"upgrading":  openlist.IsUpgrading(),
		"data_dir":   openlist.DataDir(),
		"server_dir": openlist.ServerDir(),
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
		if err := openlist.Upgrade(req.Version); err != nil {
			fmt.Fprintf(os.Stderr, "upgrade error: %v\n", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func handleLog(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(openlist.LogFile())
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
		if err := openlist.Restart(); err != nil {
			fmt.Fprintf(os.Stderr, "restart error: %v\n", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "restarting"})
}

func handleAdminInfo(w http.ResponseWriter, r *http.Request) {
	info, err := openlist.AdminInfo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"info": info})
}

func handleResetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	password, err := openlist.ResetPassword()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"password": password})
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
	http.HandleFunc("/api/admin/info", handleAdminInfo)
	http.HandleFunc("/api/admin/reset", handleResetPassword)

	fmt.Printf("Admin panel listening on :%s\n", adminPort)
	if err := http.ListenAndServe(":"+adminPort, nil); err != nil {
		fmt.Fprintf(os.Stderr, "admin panel error: %v\n", err)
		os.Exit(1)
	}
}
