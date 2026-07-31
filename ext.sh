#!/usr/bin/env bash
#
# Register this extension with pi for local testing.
#
#   ./ext.sh install     add to pi's user settings, then prove it loaded
#   ./ext.sh uninstall   remove from pi's user settings
#   ./ext.sh status      report whether pi has it and what it exposes
#   ./ext.sh try         run pi once with it, touching no settings
#
# A local install is registered by path, never copied, so edits under src/ are
# live in the next pi session — `/reload` picks them up without restarting.
# There is no "reinstall".
set -euo pipefail

PACKAGE_NAME="@tokenswim/pi"

# Locate the package by walking up for its own package.json, never by stepping a
# fixed number of levels up from the script. Two ways that goes wrong, both hit
# in practice: `${BASH_SOURCE[0]}` is empty when the body is fed to bash rather
# than run as a file, and a hardcoded `/..` breaks the moment the script moves
# between directories. Either way a relative step-up resolves to some unrelated
# parent — which is how an earlier version handed a home directory to
# `pi install`. Search, verify, and fail closed.
find_root() {
	local dir
	if [ -n "${BASH_SOURCE[0]:-}" ] && [ -e "${BASH_SOURCE[0]}" ]; then
		dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	else
		dir="$PWD"
	fi
	while [ "$dir" != "/" ]; do
		if [ -f "$dir/package.json" ] &&
			grep -qE "\"name\"[[:space:]]*:[[:space:]]*\"$PACKAGE_NAME\"" "$dir/package.json"; then
			printf '%s\n' "$dir"
			return 0
		fi
		dir="$(dirname "$dir")"
	done
	return 1
}

if ! ROOT="$(find_root)"; then
	echo "Could not find the $PACKAGE_NAME package from here." >&2
	echo "Run this from inside a checkout: cd /path/to/tokenswim-pi && ./ext.sh ${1:-status}" >&2
	exit 1
fi

usage() {
	cat <<'USAGE'
Register this extension with pi for local testing.

  ./ext.sh install     add to pi's user settings, then prove it loaded
  ./ext.sh uninstall   remove from pi's user settings
  ./ext.sh status      report whether pi has it and what it exposes
  ./ext.sh try         run pi once with it, touching no settings

A local install is registered by path, never copied, so edits under src/ are
live in the next pi session — /reload picks them up without restarting.
USAGE
}

# pi resolves auth before listing, so a provider with no credential is hidden.
# Borrow the real key if there is one, otherwise a placeholder that is never sent.
probe_key() { echo "${TOKENSWIM_API_KEY:-sk-probe}"; }

# pi loads a broken extension silently: no error, no warning, the provider just
# never appears. So never trust the install message — ask pi what it can see.
loaded_models() {
	TOKENSWIM_API_KEY="$(probe_key)" pi "$@" --list-models 2>/dev/null |
		awk '$1 == "tokenswim" { print $2 }'
}

case "${1:-}" in
install)
	pi install "$ROOT"
	models="$(loaded_models || true)"
	if [ -z "$models" ]; then
		echo "pi accepted the install but exposes no tokenswim models — the extension failed to load." >&2
		echo "Run './ext.sh try' to reproduce, and check that src/ imports only" >&2
		echo "'@earendil-works/pi-ai' or '@earendil-works/pi-ai/compat'." >&2
		exit 1
	fi
	echo "Loaded $(echo "$models" | wc -l | tr -d ' ') models: $(echo "$models" | paste -sd' ')"
	;;
uninstall)
	pi remove "$ROOT"
	;;
status)
	if pi list 2>/dev/null | grep -qF "$ROOT"; then
		echo "installed: $ROOT"
		models="$(loaded_models || true)"
		if [ -n "$models" ]; then
			echo "models: $(echo "$models" | paste -sd' ')"
		else
			echo "models: none — the extension is registered but not loading" >&2
			exit 1
		fi
	else
		echo "not installed"
	fi
	;;
try)
	shift
	exec env TOKENSWIM_API_KEY="$(probe_key)" pi -e "$ROOT" "$@"
	;;
*)
	usage
	exit 1
	;;
esac
