package openlist

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func ServerDir() string {
	appDest := os.Getenv("TRIM_APPDEST")
	if appDest == "" {
		appDest = "/var/apps/fn-openlist/target"
	}
	return appDest + "/server"
}

func DataDir() string {
	pkgVar := os.Getenv("TRIM_PKGVAR")
	if pkgVar == "" {
		pkgVar = "/var/apps/fn-openlist/var"
	}
	return pkgVar
}

func VarDir() string {
	pkgVar := os.Getenv("TRIM_PKGVAR")
	if pkgVar == "" {
		pkgVar = "/var/apps/fn-openlist/var"
	}
	return pkgVar
}

func LogFile() string {
	return VarDir() + "/info.log"
}

func PidFile() string {
	return VarDir() + "/app.pid"
}

// ReadConfigPort reads the http_port from data/config.json
func ReadConfigPort() int {
	configPath := filepath.Join(DataDir(), "config.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return 0
	}

	var cfg struct {
		Scheme struct {
			HTTPPort int `json:"http_port"`
		} `json:"scheme"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return 0
	}
	return cfg.Scheme.HTTPPort
}
