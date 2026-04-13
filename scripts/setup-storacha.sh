#!/usr/bin/env bash
# ==============================================================================
# Storacha Credential Setup for SplitFare
#
# This script automates the generation of STORACHA_KEY and STORACHA_PROOF
# environment variables needed for the server-side Storacha agent.
#
# Prerequisites:
#   - Node.js >= 18
#   - npm
#
# Usage:
#   chmod +x scripts/setup-storacha.sh
#   ./scripts/setup-storacha.sh
#
# Reference: https://docs.storacha.network/how-to/upload/#bring-your-own-delegations
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Storacha Credential Setup for SplitFare       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 0: Check / Install CLI ───────────────────────────────────────────────
if ! command -v storacha &> /dev/null; then
  echo -e "${YELLOW}⚙  Installing @storacha/cli globally...${NC}"
  npm install -g @storacha/cli
  echo -e "${GREEN}✓  CLI installed.${NC}"
else
  echo -e "${GREEN}✓  @storacha/cli already installed.${NC}"
fi

# ── Step 1: Login ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}Step 1: Login to Storacha${NC}"
echo -e "  Enter the email address you want to register with Storacha."
echo -e "  You'll receive a confirmation email — click the link to verify."
echo ""
read -rp "  Email: " EMAIL

if [[ -z "$EMAIL" ]]; then
  echo -e "${RED}✗  Email cannot be empty.${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}⏳  Sending verification email to ${EMAIL}...${NC}"
echo -e "  ${YELLOW}Please check your inbox and click the confirmation link.${NC}"
storacha login "$EMAIL"
echo -e "${GREEN}✓  Login successful!${NC}"

# ── Step 2: Select payment plan (if needed) ───────────────────────────────────
echo ""
echo -e "${BLUE}Step 2: Payment Plan${NC}"
echo -e "  If prompted in your browser, select a plan (the free Starter tier works)."
echo -e "  Press Enter once you've confirmed your plan..."
read -r

# ── Step 3: Create a Space ────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}Step 3: Create a Space${NC}"
SPACE_NAME="splitfare-platform"
echo -e "  Creating space: ${CYAN}${SPACE_NAME}${NC}"

# Check if space already exists
EXISTING_SPACES=$(storacha space ls 2>/dev/null || true)
if echo "$EXISTING_SPACES" | grep -q "$SPACE_NAME"; then
  echo -e "${GREEN}✓  Space '${SPACE_NAME}' already exists.${NC}"
  echo -e "  Selecting it..."
  # Extract the DID from the listing
  SPACE_DID=$(echo "$EXISTING_SPACES" | grep "$SPACE_NAME" | awk '{print $1}' | head -1)
  storacha space use "$SPACE_DID"
else
  storacha space create "$SPACE_NAME"
  echo -e "${GREEN}✓  Space created.${NC}"
fi

echo ""
echo -e "  Current spaces:"
storacha space ls

# ── Step 4: Generate Server Agent Key ─────────────────────────────────────────
echo ""
echo -e "${BLUE}Step 4: Generate Server Agent Key${NC}"
echo -e "  This creates an Ed25519 key pair for the server-side agent."
echo ""

KEY_OUTPUT=$(storacha key create 2>&1)
echo "$KEY_OUTPUT"

# Extract the private key (starts with "Mg") and DID (starts with "did:key:")
AGENT_KEY=$(echo "$KEY_OUTPUT" | grep -oE 'Mg[A-Za-z0-9+/=]+' | head -1)
AGENT_DID=$(echo "$KEY_OUTPUT" | grep -oE 'did:key:z[A-Za-z0-9]+' | head -1)

if [[ -z "$AGENT_KEY" || -z "$AGENT_DID" ]]; then
  echo -e "${RED}✗  Failed to extract key or DID. Raw output above.${NC}"
  echo -e "  Please manually extract the private key (Mg...) and DID (did:key:z...)."
  exit 1
fi

echo ""
echo -e "${GREEN}✓  Agent key generated.${NC}"
echo -e "  DID: ${CYAN}${AGENT_DID}${NC}"

# ── Step 5: Create Delegation Proof ──────────────────────────────────────────
echo ""
echo -e "${BLUE}Step 5: Create Delegation Proof${NC}"
echo -e "  Delegating upload capabilities to the server agent..."
echo ""

PROOF=$(storacha delegation create "$AGENT_DID" \
  --can 'space/blob/add' \
  --can 'space/index/add' \
  --can 'filecoin/offer' \
  --can 'upload/add' \
  --can 'space/blob/list' \
  --can 'upload/list' \
  --base64 2>&1)

if [[ -z "$PROOF" ]]; then
  echo -e "${RED}✗  Failed to create delegation.${NC}"
  exit 1
fi

echo -e "${GREEN}✓  Delegation proof created.${NC}"

# ── Step 6: Output ────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Add these to your .env file              ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}STORACHA_KEY=${AGENT_KEY}${NC}"
echo ""
echo -e "${GREEN}STORACHA_PROOF=${PROOF}${NC}"
echo ""

# Also output SPACE_DID if we found one
CURRENT_SPACE_DID=$(storacha space ls 2>/dev/null | grep '\*' | awk '{print $2}' || true)
if [[ -n "$CURRENT_SPACE_DID" ]]; then
  echo -e "${GREEN}STORACHA_SPACE_DID=${CURRENT_SPACE_DID}${NC}"
  echo ""
fi

echo -e "${YELLOW}⚠  Keep these values secret! Do not commit them to version control.${NC}"
echo ""
echo -e "${BLUE}Done! Copy the values above into your .env file and restart the dev server.${NC}"
echo ""
