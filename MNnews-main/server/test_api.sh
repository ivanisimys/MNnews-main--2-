#!/bin/bash

# Скрипт для тестирования API MNnews
# Использование: bash test_api.sh [BASE_URL]

BASE_URL=${1:-"http://localhost:3000"}

echo "=========================================="
echo "MNnews API Test Suite"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

# Функция для тестирования endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_status=$5
    
    echo -e "${BLUE}Testing: $name${NC}"
    echo "  $method $url"
    
    if [ -n "$data" ]; then
        echo "  Data: $data"
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq "$expected_status" ] 2>/dev/null; then
        echo -e "  ${GREEN}✓ PASS${NC} (Status: $http_code)"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $http_code)"
        FAIL=$((FAIL + 1))
    fi
    
    # Показываем ответ если есть ошибка
    if [ "$http_code" -ne "$expected_status" ] 2>/dev/null; then
        echo "  Response: $body"
    fi
    
    echo ""
}

# Тест 1: Health check
test_endpoint "Health Check" "GET" "$BASE_URL/api/health" "" 200

# Тест 2: Получение списка новостей
test_endpoint "Get News List" "GET" "$BASE_URL/api/news" "" 200

# Тест 3: Регистрация нового пользователя
echo -e "${YELLOW}Creating test user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser_'$(date +%s)'","email":"test'$(date +%s)'@example.com","password":"testpass123"}')

echo "Response: $REGISTER_RESPONSE"
echo ""

# Извлекаем имя пользователя из ответа (если регистрация успешна)
TEST_USER=$(echo $REGISTER_RESPONSE | grep -o '"username":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TEST_USER" ]; then
    echo -e "${GREEN}Test user created: $TEST_USER${NC}"
    echo ""
else
    echo -e "${YELLOW}Could not create test user, using existing admin account for further tests${NC}"
    TEST_USER="admin"
    echo ""
fi

# Тест 4: Попытка регистрации с существующим username
test_endpoint "Duplicate Registration" "POST" "$BASE_URL/api/auth/register" \
    '{"username":"admin","email":"another@example.com","password":"pass123"}' 409

# Тест 5: Вход с неверными данными
test_endpoint "Invalid Login" "POST" "$BASE_URL/api/auth/login" \
    '{"username":"admin","password":"wrongpassword"}' 401

# Тест 6: Вход без данных
test_endpoint "Login Without Credentials" "POST" "$BASE_URL/api/auth/login" \
    '{}' 400

# Тест 7: Получение профиля несуществующего пользователя
test_endpoint "Get Non-existent Profile" "GET" \
    "$BASE_URL/api/auth/profile/nonexistentuser" "" 404

# Тест 8: Попытка доступа к заявкам без авторизации
test_endpoint "Access Requests Without Auth" "GET" \
    "$BASE_URL/api/auth/registration-requests?actor=" "" 400

# Тест 9: Создание новости без авторизации
test_endpoint "Create News Without Auth" "POST" "$BASE_URL/api/news" \
    '{"title":"Test","content":"Test content"}' 403

# Тест 10: Проверка создания пользователя администратором
test_endpoint "Create User Without Auth" "POST" "$BASE_URL/api/auth/users" \
    '{"actor":"admin","username":"newuser","password":"pass123"}' 403

echo "=========================================="
echo "Test Results Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo "Total: $((PASS + FAIL))"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi
