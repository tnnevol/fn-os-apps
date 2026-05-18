package openlist

import (
	"os"
	"strings"
)

func ServerDir() string {
	appDest := os.Getenv("TRIM_APPDEST")
	if appDest == "" {
		appDest = "/var/apps/fn-openlist/target"
	}
	return appDest + "/server"
}

func DataDir() string {
	dataShares := os.Getenv("TRIM_DATA_SHARE_PATHS")
	if dataShares != "" {
		return strings.Split(dataShares, ":")[0]
	}
	return ""
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
