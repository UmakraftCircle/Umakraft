#!/usr/bin/env bash
# Prevent the ${'{var}'} anti-pattern where a template literal expression
# silently drops the dollar sign.  The JS expression ${'{timeOfDay}'}
# evaluates to the string {timeOfDay}, NOT ${timeOfDay} — so any
# downstream replaceAll('${timeOfDay}', ...) will never match and real
# data never reaches the AI prompt.
#
# Correct forms:  ${'${var}'}  (produces literal ${var})
#                 vars.var     (use the vars parameter directly)
set -euo pipefail

matches=$(grep -rlnF "\${'{" --include='*.ts' packages/ 2>/dev/null || true)

if [ -n "$matches" ]; then
  echo ""
  echo "❌  BROKEN TEMPLATE PATTERN — \${'{...}'} found in:"
  echo "   $matches"
  echo ""
  echo "   This evaluates to {var} without the dollar sign, so"
  echo "   replaceAll('\${var}', ...) silently skips the data."
  echo ""
  echo "   Fix: change \${'{varname}'} → \${'\${varname}'}"
  echo "        or use vars.varname directly in the template."
  echo ""
  exit 1
fi

echo "✅  No broken \${'{...}'} template patterns detected."
exit 0
