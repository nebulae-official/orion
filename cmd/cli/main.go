package main

import (
	"os"

	"github.com/orion-rigel/orion/internal/cli/commands"
)

func main() {
	if err := commands.Execute(); err != nil {
		os.Exit(1)
	}
}
