#!/bin/bash

# Скрипт для настройки прав доступа и проверки работоспособности MNnews на Ubuntu Server
# Использование: bash setup_permissions.sh

echo "=========================================="
echo "MNnews Server Setup Script"
echo "=========================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Получаем текущую директорию
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_ROOT/data"
SERVER_DIR="$SCRIPT_DIR"

echo -e "${YELLOW}Project root: $PROJECT_ROOT${NC}"
echo -e "${YELLOW}Data directory: $DATA_DIR${NC}"
echo ""

# Проверка существования директории data
echo "1. Checking data directory..."
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${YELLOW}Creating data directory...${NC}"
    mkdir -p "$DATA_DIR"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Data directory created${NC}"
    else
        echo -e "${RED}✗ Failed to create data directory${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Data directory exists${NC}"
fi

# Проверка существования файлов данных
echo ""
echo "2. Checking data files..."

if [ ! -f "$DATA_DIR/news.json" ]; then
    echo -e "${YELLOW}Creating news.json...${NC}"
    echo '[]' > "$DATA_DIR/news.json"
    echo -e "${GREEN}✓ news.json created${NC}"
else
    echo -e "${GREEN}✓ news.json exists${NC}"
fi

if [ ! -f "$DATA_DIR/users.json" ]; then
    echo -e "${YELLOW}Creating users.json...${NC}"
    echo '[]' > "$DATA_DIR/users.json"
    echo -e "${GREEN}✓ users.json created${NC}"
else
    echo -e "${GREEN}✓ users.json exists${NC}"
fi

# Установка прав доступа
echo ""
echo "3. Setting permissions..."

# Права на директорию data
chmod 755 "$DATA_DIR"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Directory permissions set to 755${NC}"
else
    echo -e "${RED}✗ Failed to set directory permissions${NC}"
fi

# Права на файлы данных
chmod 644 "$DATA_DIR/news.json"
chmod 644 "$DATA_DIR/users.json"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ File permissions set to 644${NC}"
else
    echo -e "${RED}✗ Failed to set file permissions${NC}"
fi

# Установка владельца (если запускается от root)
if [ "$EUID" -eq 0 ]; then
    echo ""
    echo "4. Running as root, setting ownership..."
    CURRENT_USER=$(logname 2>/dev/null || echo $SUDO_USER || whoami)
    
    if [ ! -z "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ]; then
        chown -R "$CURRENT_USER:$CURRENT_USER" "$DATA_DIR"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Ownership set to $CURRENT_USER${NC}"
        else
            echo -e "${RED}✗ Failed to set ownership${NC}"
        fi
    else
        echo -e "${YELLOW}Could not determine original user, skipping ownership change${NC}"
    fi
else
    echo -e "${YELLOW}Not running as root, skipping ownership change${NC}"
fi

# Проверка Node.js
echo ""
echo "5. Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js installed: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "Install with: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi

# Проверка npm
echo ""
echo "6. Checking npm installation..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm installed: $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi

# Установка зависимостей
echo ""
echo "7. Installing dependencies..."
cd "$SERVER_DIR"
if [ -f "package.json" ]; then
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dependencies installed${NC}"
    else
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ package.json not found in $SERVER_DIR${NC}"
    exit 1
fi

# Проверка порта
echo ""
echo "8. Checking if port 3000 is available..."
if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
    echo -e "${RED}✗ Port 3000 is already in use${NC}"
    echo "Stop the existing service or choose a different port"
else
    echo -e "${GREEN}✓ Port 3000 is available${NC}"
fi

# Финальная проверка
echo ""
echo "=========================================="
echo -e "${GREEN}Setup completed successfully!${NC}"
echo "=========================================="
echo ""
echo "To start the server, run:"
echo "  cd $SERVER_DIR"
echo "  npm start"
echo ""
echo "Or use PM2 for production:"
echo "  npm install -g pm2"
echo "  pm2 start index.js --name mnnews"
echo "  pm2 save"
echo "  pm2 startup"
echo ""
echo "Server will be available at: http://localhost:3000"
echo ""
