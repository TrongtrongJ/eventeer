command_exists () {
  command -v "$1" >/dev/null 2>&1
}

# Workaround for Windows CMD, Git Bash, and Yarn/NPM interactive tasks
if command_exists winpty && test -t 1; then
  exec < /dev/tty
fi