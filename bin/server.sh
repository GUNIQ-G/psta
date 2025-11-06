#!/bin/bash

# PSTA Server Management Script
# Usage: ./bin/server.sh {start|stop|restart|status} [component]
# Components: all, db, backend, frontend, prisma-studio

PROJECT_ROOT="/app/psta"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
LOG_DIR="/log/psta"
BACKEND_LOG="$LOG_DIR/app/backend/backend-console.log"
FRONTEND_LOG="$LOG_DIR/app/frontend/frontend-console.log"
PRISMA_STUDIO_LOG="$LOG_DIR/system/prisma-studio.log"
SERVER_LOG="$LOG_DIR/system/server.log"
BACKEND_PID_FILE="/tmp/psta-backend.pid"
FRONTEND_PID_FILE="/tmp/psta-frontend.pid"
PRISMA_STUDIO_PID_FILE="/tmp/psta-prisma-studio.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_to_file() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$SERVER_LOG"
}

print_header() {
    echo -e "${BLUE}===================================================${NC}"
    echo -e "${BLUE}          $1${NC}"
    echo -e "${BLUE}===================================================${NC}"
    log_to_file "$1"
}

print_component() {
    echo -e "\n${YELLOW}$1:${NC}"
}

#####################################
# Status Functions
#####################################

status_db() {
    print_component "Database (psta-postgres - Port 5432)"

    # Check if psta-postgres docker container is running
    if docker ps --format '{{.Names}}' | grep -q "^psta-postgres$"; then
        echo -e "  Status: ${GREEN}✓ Running (Docker)${NC}"
        CONTAINER_ID=$(docker ps -q -f name=psta-postgres)
        echo -e "  Container: $CONTAINER_ID"

        # Health check
        if docker exec psta-postgres pg_isready -U psta_user -d psta > /dev/null 2>&1; then
            echo -e "  Health: ${GREEN}✓ OK${NC}"
        else
            echo -e "  Health: ${RED}✗ Not responding${NC}"
        fi
    else
        echo -e "  Status: ${RED}✗ Stopped${NC}"
        echo -e "  ${YELLOW}Start with: ./bin/server.sh start db${NC}"
    fi
}

status_backend() {
    print_component "Backend API (Port 3001)"

    # Check for both production (node dist/index.js) and dev (ts-node src/index.ts) modes
    local backend_pid=""
    local backend_mode=""

    if pgrep -f "node dist/index.js" > /dev/null; then
        backend_pid=$(pgrep -f "node dist/index.js" | head -1)
        backend_mode="Production (systemd)"
    elif pgrep -f "ts-node src/index.ts" > /dev/null; then
        backend_pid=$(pgrep -f "ts-node src/index.ts" | head -1)
        backend_mode="Development"
    fi

    if [ ! -z "$backend_pid" ]; then
        echo -e "  Status: ${GREEN}✓ Running${NC} ($backend_mode)"
        echo -e "  PID: $backend_pid"

        if curl -s http://localhost:3001/health > /dev/null 2>&1; then
            echo -e "  Health: ${GREEN}✓ OK${NC}"
        else
            echo -e "  Health: ${RED}✗ Not responding${NC}"
        fi

        echo -e "  Log: $BACKEND_LOG"
    else
        echo -e "  Status: ${RED}✗ Stopped${NC}"
    fi
}

status_frontend() {
    print_component "Frontend UI (Port 3000)"

    if pgrep -f "serve -s dist" > /dev/null; then
        local pid=$(pgrep -f "serve -s dist" | head -1)
        echo -e "  Status: ${GREEN}✓ Running${NC} (Production - serve)"
        echo -e "  PID: $pid"

        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e "  Health: ${GREEN}✓ OK${NC}"
        else
            echo -e "  Health: ${RED}✗ Not responding${NC}"
        fi

        echo -e "  Log: $FRONTEND_LOG"
    else
        echo -e "  Status: ${RED}✗ Stopped${NC}"
    fi
}

status_prisma_studio() {
    print_component "Prisma Studio (Port 5555)"

    if pgrep -f "prisma studio" > /dev/null; then
        echo -e "  Status: ${GREEN}✓ Running${NC}"
        PRISMA_PID=$(pgrep -f "prisma studio" | head -1)
        if [ ! -z "$PRISMA_PID" ]; then
            echo -e "  PID: $PRISMA_PID"
        fi

        if curl -s http://localhost:5555 > /dev/null 2>&1; then
            echo -e "  Health: ${GREEN}✓ OK${NC}"
            echo -e "  URL: ${CYAN}http://localhost:5555${NC}"
        else
            echo -e "  Health: ${YELLOW}⚠ Starting...${NC}"
        fi

        echo -e "  Log: $PRISMA_STUDIO_LOG"
    else
        echo -e "  Status: ${RED}✗ Stopped${NC}"
    fi
}

print_network_info() {
    print_component "Network Access"
    IP=$(hostname -I | awk '{print $1}')
    echo -e "  Frontend:      ${CYAN}http://${IP}:3000${NC}"
    echo -e "  Backend:       ${CYAN}http://${IP}:3001${NC}"
    echo -e "  Prisma Studio: ${CYAN}http://${IP}:5555${NC}"
    echo -e "  Database:      ${CYAN}postgresql://${IP}:5432/psta${NC}"
}

print_status() {
    print_header "PSTA System Status"
    status_db
    status_backend
    status_frontend
    status_prisma_studio
    print_network_info
    echo -e "\n${BLUE}===================================================${NC}\n"
}

#####################################
# Start Functions
#####################################

start_db() {
    echo -e "${YELLOW}Starting Database (PostgreSQL)...${NC}"
    log_to_file "Starting PostgreSQL Database..."

    # Check if psta-postgres docker container is already running
    if docker ps --format '{{.Names}}' | grep -q "^psta-postgres$"; then
        echo -e "${YELLOW}psta-postgres is already running (Docker)${NC}"
        log_to_file "psta-postgres already running (Docker)"
        return 0
    fi

    # Check if psta-postgres container exists (but stopped)
    if docker ps -a --format '{{.Names}}' | grep -q "^psta-postgres$"; then
        echo -e "${CYAN}Starting existing psta-postgres container...${NC}"
        docker start psta-postgres

        # Wait for PostgreSQL to be ready
        echo -n "Waiting for psta-postgres to be ready"
        for i in {1..30}; do
            if docker exec psta-postgres pg_isready -U psta_user -d psta > /dev/null 2>&1; then
                echo -e "\n${GREEN}✓ psta-postgres started successfully (Docker)${NC}"
                log_to_file "psta-postgres started successfully (Docker)"
                return 0
            fi
            echo -n "."
            sleep 1
        done

        echo -e "\n${RED}✗ psta-postgres started but health check timeout${NC}"
        log_to_file "psta-postgres started but health check timeout"
        return 1
    fi

    # Container doesn't exist - try docker-compose to create it
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        cd "$PROJECT_ROOT"
        echo -e "${CYAN}Creating psta-postgres container with docker-compose...${NC}"

        # Try docker compose (v2) first, then docker-compose (v1)
        if command -v docker &> /dev/null && docker compose version &> /dev/null; then
            docker compose up -d postgres
        elif command -v docker-compose &> /dev/null; then
            docker-compose up -d postgres
        else
            echo -e "${RED}✗ Neither 'docker compose' nor 'docker-compose' found${NC}"
            return 1
        fi

        # Wait for PostgreSQL to be ready
        echo -n "Waiting for psta-postgres to be ready"
        for i in {1..30}; do
            if docker exec psta-postgres pg_isready -U psta_user -d psta > /dev/null 2>&1; then
                echo -e "\n${GREEN}✓ psta-postgres created and started successfully${NC}"
                log_to_file "psta-postgres created and started successfully (Docker)"
                return 0
            fi
            echo -n "."
            sleep 1
        done

        echo -e "\n${RED}✗ psta-postgres started but health check timeout${NC}"
        log_to_file "psta-postgres started but health check timeout"
        return 1
    else
        echo -e "${RED}✗ docker-compose.yml not found${NC}"
        echo -e "${YELLOW}Cannot start psta-postgres without docker-compose.yml${NC}"
        return 1
    fi
}

start_backend() {
    echo -e "${YELLOW}Starting Backend...${NC}"
    log_to_file "Starting Backend..."

    # Check if systemd service exists and is enabled
    if systemctl is-enabled psta-backend > /dev/null 2>&1; then
        # Use systemd
        if systemctl is-active psta-backend > /dev/null 2>&1; then
            echo -e "${YELLOW}Backend is already running (systemd)${NC}"
            log_to_file "Backend already running (systemd)"
            return 0
        fi

        echo -e "${CYAN}Starting backend via systemd...${NC}"
        sudo systemctl start psta-backend

        # Wait for backend to start
        echo -n "Waiting for backend to start"
        for i in {1..20}; do
            if systemctl is-active psta-backend > /dev/null 2>&1 && curl -s http://localhost:3001/health > /dev/null 2>&1; then
                echo -e "\n${GREEN}✓ Backend started successfully (systemd)${NC}"
                log_to_file "Backend started successfully (systemd)"
                return 0
            fi
            echo -n "."
            sleep 1
        done

        echo -e "\n${YELLOW}⚠ Backend started but health check failed${NC}"
        echo -e "  Check status: sudo systemctl status psta-backend"
        return 1
    fi

    # No systemd service - use direct process management
    if pgrep -f "ts-node src/index.ts" > /dev/null; then
        echo -e "${YELLOW}Backend is already running (Development)${NC}"
        log_to_file "Backend already running (dev)"
        return 0
    fi

    # Check if PostgreSQL is running
    if ! docker ps --format '{{.Names}}' | grep -q "psta-postgres" && ! pgrep -f postgres > /dev/null; then
        echo -e "${RED}✗ Error: PostgreSQL is not running!${NC}"
        echo -e "${YELLOW}Start PostgreSQL first:${NC}"
        echo -e "  ./bin/server.sh start db"
        return 1
    fi

    # Check if port 3001 is already in use
    if lsof -i :3001 > /dev/null 2>&1 || ss -tlnp | grep -q ":3001" > /dev/null 2>&1; then
        echo -e "${RED}✗ Error: Port 3001 is already in use!${NC}"
        echo -e "${YELLOW}Stop the existing backend first${NC}"
        return 1
    fi

    cd "$BACKEND_DIR"
    npm run dev > "$BACKEND_LOG" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"

    # Wait for backend to start
    echo -n "Waiting for backend to start"
    for i in {1..20}; do
        if curl -s http://localhost:3001/health > /dev/null 2>&1; then
            echo -e "\n${GREEN}✓ Backend started successfully (dev mode)${NC}"
            echo -e "  Log: $BACKEND_LOG"
            log_to_file "Backend started successfully (dev)"
            return 0
        fi
        echo -n "."
        sleep 1
    done

    echo -e "\n${YELLOW}⚠ Backend started but health check failed${NC}"
    echo -e "  Check logs: tail -f $BACKEND_LOG"
}

start_frontend() {
    echo -e "${YELLOW}Starting Frontend...${NC}"
    log_to_file "Starting Frontend..."

    # Check if systemd service exists and is enabled
    if systemctl is-enabled psta-frontend > /dev/null 2>&1; then
        # Use systemd
        if systemctl is-active psta-frontend > /dev/null 2>&1; then
            echo -e "${YELLOW}Frontend is already running (systemd)${NC}"
            log_to_file "Frontend already running (systemd)"
            return 0
        fi

        echo -e "${CYAN}Starting frontend via systemd...${NC}"
        sudo systemctl start psta-frontend

        # Wait for frontend to start
        echo -n "Waiting for frontend to start"
        for i in {1..20}; do
            if systemctl is-active psta-frontend > /dev/null 2>&1 && curl -s http://localhost:3000 > /dev/null 2>&1; then
                echo -e "\n${GREEN}✓ Frontend started successfully (systemd)${NC}"
                log_to_file "Frontend started successfully (systemd)"
                return 0
            fi
            echo -n "."
            sleep 1
        done

        echo -e "\n${YELLOW}⚠ Frontend started but health check failed${NC}"
        echo -e "  Check status: sudo systemctl status psta-frontend"
        return 1
    fi

    # No systemd service - direct process management
    if pgrep -f "serve -s dist" > /dev/null; then
        echo -e "${YELLOW}Frontend is already running (production mode)${NC}"
        log_to_file "Frontend already running (production)"
        return 0
    fi

    cd "$FRONTEND_DIR"

    # Use serve for production static files
    echo -e "${CYAN}Starting production server with serve${NC}"
    nohup serve -s dist -l 3000 -n > "$FRONTEND_LOG" 2>&1 &

    echo $! > "$FRONTEND_PID_FILE"

    # Wait for frontend to start
    echo -n "Waiting for frontend to start"
    for i in {1..20}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e "\n${GREEN}✓ Frontend started successfully (production mode)${NC}"
            echo -e "  Log: $FRONTEND_LOG"
            log_to_file "Frontend started successfully (production)"
            return 0
        fi
        echo -n "."
        sleep 1
    done

    echo -e "\n${YELLOW}⚠ Frontend started but health check failed${NC}"
    echo -e "  Check logs: tail -f $FRONTEND_LOG"
    log_to_file "Frontend started but health check failed"
}

start_prisma_studio() {
    echo -e "${YELLOW}Starting Prisma Studio...${NC}"

    # Check if already running
    if pgrep -f "prisma studio" > /dev/null; then
        echo -e "${YELLOW}Prisma Studio is already running${NC}"
        return 0
    fi

    cd "$BACKEND_DIR"
    npx prisma studio --port 5555 > "$PRISMA_STUDIO_LOG" 2>&1 &
    echo $! > "$PRISMA_STUDIO_PID_FILE"

    # Wait for Prisma Studio to start
    echo -n "Waiting for Prisma Studio to start"
    for i in {1..15}; do
        if curl -s http://localhost:5555 > /dev/null 2>&1; then
            echo -e "\n${GREEN}✓ Prisma Studio started successfully${NC}"
            echo -e "  URL: ${CYAN}http://localhost:5555${NC}"
            echo -e "  Log: $PRISMA_STUDIO_LOG"
            return 0
        fi
        echo -n "."
        sleep 1
    done

    echo -e "\n${YELLOW}⚠ Prisma Studio started but health check failed${NC}"
    echo -e "  Check logs: tail -f $PRISMA_STUDIO_LOG"
}

#####################################
# Stop Functions
#####################################

stop_db() {
    echo -e "${YELLOW}Stopping Database (PostgreSQL)...${NC}"
    log_to_file "Stopping psta-postgres Database..."

    if docker ps --format '{{.Names}}' | grep -q "^psta-postgres$"; then
        echo -e "${CYAN}Stopping psta-postgres container...${NC}"
        docker stop psta-postgres

        # Verify it stopped
        sleep 2
        if ! docker ps --format '{{.Names}}' | grep -q "^psta-postgres$"; then
            echo -e "${GREEN}✓ psta-postgres stopped (Docker)${NC}"
            log_to_file "psta-postgres stopped successfully (Docker)"
            return 0
        else
            echo -e "${RED}✗ Failed to stop psta-postgres${NC}"
            log_to_file "Failed to stop psta-postgres (Docker)"
            return 1
        fi
    else
        echo -e "${YELLOW}psta-postgres is not running${NC}"
        log_to_file "psta-postgres was not running"
        return 0
    fi
}

stop_backend() {
    echo -e "${YELLOW}Stopping Backend...${NC}"
    log_to_file "Stopping Backend..."

    # Check if systemd service exists and is enabled
    if systemctl is-enabled psta-backend > /dev/null 2>&1; then
        # Use systemd
        if ! systemctl is-active psta-backend > /dev/null 2>&1; then
            echo -e "${YELLOW}Backend is not running (systemd)${NC}"
            log_to_file "Backend was not running (systemd)"
            return 0
        fi

        echo -e "${CYAN}Stopping backend via systemd...${NC}"
        sudo systemctl stop psta-backend

        # Wait for backend to stop
        sleep 2
        if ! systemctl is-active psta-backend > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend stopped (systemd)${NC}"
            log_to_file "Backend stopped successfully (systemd)"
            return 0
        else
            echo -e "${RED}✗ Failed to stop backend${NC}"
            echo -e "  Check status: sudo systemctl status psta-backend"
            return 1
        fi
    fi

    # No systemd service - stop development backend
    if pkill -f "nodemon src/index.ts" || pkill -f "ts-node src/index.ts"; then
        echo -e "${GREEN}✓ Backend stopped (dev mode)${NC}"
        log_to_file "Backend stopped successfully (dev)"
    else
        echo -e "${YELLOW}Backend was not running${NC}"
        log_to_file "Backend was not running"
    fi

    # Clean up PID file
    [ -f "$BACKEND_PID_FILE" ] && rm "$BACKEND_PID_FILE"

    # Force kill if still running
    sleep 1
    if pgrep -f "ts-node src/index.ts" > /dev/null; then
        echo -e "${RED}Force killing backend...${NC}"
        pkill -9 -f "ts-node src/index.ts"
    fi
}

stop_frontend() {
    echo -e "${YELLOW}Stopping Frontend...${NC}"
    log_to_file "Stopping Frontend..."

    # Check if systemd service exists and is enabled
    if systemctl is-enabled psta-frontend > /dev/null 2>&1; then
        # Use systemd
        if ! systemctl is-active psta-frontend > /dev/null 2>&1; then
            echo -e "${YELLOW}Frontend is not running (systemd)${NC}"
            log_to_file "Frontend was not running (systemd)"
            return 0
        fi

        echo -e "${CYAN}Stopping frontend via systemd...${NC}"
        sudo systemctl stop psta-frontend

        # Wait for frontend to stop
        sleep 2
        if ! systemctl is-active psta-frontend > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Frontend stopped (systemd)${NC}"
            log_to_file "Frontend stopped successfully (systemd)"
            return 0
        else
            echo -e "${RED}✗ Failed to stop frontend${NC}"
            echo -e "  Check status: sudo systemctl status psta-frontend"
            return 1
        fi
    fi

    # No systemd service - stop serve process
    if pkill -f "serve -s dist"; then
        echo -e "${GREEN}✓ Production server stopped (serve)${NC}"
        log_to_file "Frontend stopped successfully (production)"
    else
        echo -e "${YELLOW}Frontend was not running${NC}"
        log_to_file "Frontend was not running"
    fi

    # Clean up PID file
    [ -f "$FRONTEND_PID_FILE" ] && rm "$FRONTEND_PID_FILE"

    # Force kill if still running
    sleep 1
    if pgrep -f "serve -s dist" > /dev/null; then
        echo -e "${RED}Force killing serve...${NC}"
        pkill -9 -f "serve -s dist"
    fi
}

stop_prisma_studio() {
    echo -e "${YELLOW}Stopping Prisma Studio...${NC}"

    if pkill -f "prisma studio"; then
        echo -e "${GREEN}✓ Prisma Studio stopped${NC}"
    else
        echo -e "${YELLOW}Prisma Studio was not running${NC}"
    fi

    # Clean up PID file
    [ -f "$PRISMA_STUDIO_PID_FILE" ] && rm "$PRISMA_STUDIO_PID_FILE"
}

#####################################
# Main Command Handler
#####################################

COMMAND=$1
COMPONENT=${2:-all}

case "$COMMAND" in
    start)
        print_header "Starting PSTA Components"
        echo ""

        case "$COMPONENT" in
            all)
                start_db
                echo ""
                start_backend
                echo ""
                start_frontend
                echo ""
                print_status
                echo -e "${GREEN}💡 Tip: Start Prisma Studio with: ./bin/server.sh start prisma-studio${NC}"
                echo -e "${GREEN}🔑 Login with: admin / proadmin${NC}\n"
                ;;
            db|database|postgres)
                start_db
                ;;
            backend|api)
                start_backend
                ;;
            frontend|ui)
                start_frontend
                ;;
            prisma-studio|studio)
                start_prisma_studio
                ;;
            *)
                echo -e "${RED}Unknown component: $COMPONENT${NC}"
                echo -e "Available components: all, db, backend, frontend, prisma-studio"
                exit 1
                ;;
        esac
        ;;

    stop)
        print_header "Stopping PSTA Components"
        echo ""

        case "$COMPONENT" in
            all)
                stop_backend
                echo ""
                stop_frontend
                echo ""
                stop_db
                echo ""
                echo -e "${GREEN}✓ All components stopped${NC}"
                echo -e "${YELLOW}💡 Tip: Prisma Studio is not stopped (not included in 'all')${NC}\n"
                ;;
            db|database|postgres)
                stop_db
                ;;
            backend|api)
                stop_backend
                ;;
            frontend|ui)
                stop_frontend
                ;;
            prisma-studio|studio)
                stop_prisma_studio
                ;;
            *)
                echo -e "${RED}Unknown component: $COMPONENT${NC}"
                echo -e "Available components: all, db, backend, frontend, prisma-studio"
                exit 1
                ;;
        esac
        ;;

    restart)
        print_header "Restarting PSTA Components"
        echo ""

        case "$COMPONENT" in
            all)
                stop_backend
                stop_frontend
                stop_db
                echo ""
                sleep 2
                start_db
                echo ""
                start_backend
                echo ""
                start_frontend
                echo ""
                print_status
                echo -e "${GREEN}💡 Tip: Prisma Studio is not restarted (not included in 'all')${NC}"
                echo -e "${GREEN}🔑 Login with: admin / proadmin${NC}\n"
                ;;
            db|database|postgres)
                stop_db
                sleep 2
                start_db
                ;;
            backend|api)
                stop_backend
                sleep 2
                start_backend
                ;;
            frontend|ui)
                stop_frontend
                sleep 2
                start_frontend
                ;;
            prisma-studio|studio)
                stop_prisma_studio
                sleep 2
                start_prisma_studio
                ;;
            *)
                echo -e "${RED}Unknown component: $COMPONENT${NC}"
                echo -e "Available components: all, db, backend, frontend, prisma-studio"
                exit 1
                ;;
        esac
        ;;

    status)
        if [ "$COMPONENT" == "all" ]; then
            print_status
        else
            print_header "PSTA Component Status"
            case "$COMPONENT" in
                db|database|postgres)
                    status_db
                    ;;
                backend|api)
                    status_backend
                    ;;
                frontend|ui)
                    status_frontend
                    ;;
                prisma-studio|studio)
                    status_prisma_studio
                    ;;
                *)
                    echo -e "${RED}Unknown component: $COMPONENT${NC}"
                    echo -e "Available components: all, db, backend, frontend, prisma-studio"
                    exit 1
                    ;;
            esac
            echo ""
        fi
        ;;

    logs)
        if [ -z "$COMPONENT" ] || [ "$COMPONENT" == "all" ]; then
            echo -e "${YELLOW}Usage: $0 logs <component>${NC}"
            echo -e "Available components: backend, frontend, prisma-studio"
            exit 1
        fi

        case "$COMPONENT" in
            backend|api)
                echo -e "${YELLOW}Backend logs (Ctrl+C to exit):${NC}"
                tail -f "$BACKEND_LOG"
                ;;
            frontend|ui)
                echo -e "${YELLOW}Frontend logs (Ctrl+C to exit):${NC}"
                tail -f "$FRONTEND_LOG"
                ;;
            prisma-studio|studio)
                echo -e "${YELLOW}Prisma Studio logs (Ctrl+C to exit):${NC}"
                tail -f "$PRISMA_STUDIO_LOG"
                ;;
            *)
                echo -e "${RED}Unknown component: $COMPONENT${NC}"
                echo -e "Available components: backend, frontend, prisma-studio"
                exit 1
                ;;
        esac
        ;;

    *)
        echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║         PSTA Server Management Script            ║${NC}"
        echo -e "${CYAN}║                   v2.0                           ║${NC}"
        echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${YELLOW}Usage:${NC}"
        echo -e "  $0 ${GREEN}<command>${NC} [component]"
        echo ""
        echo -e "${YELLOW}Commands:${NC}"
        echo -e "  ${GREEN}start${NC}     - Start components"
        echo -e "  ${GREEN}stop${NC}      - Stop components (including database!)"
        echo -e "  ${GREEN}restart${NC}   - Restart components (including database!)"
        echo -e "  ${GREEN}status${NC}    - Show component status"
        echo -e "  ${GREEN}logs${NC}      - View component logs (logs <component>)"
        echo ""
        echo -e "${YELLOW}Components:${NC}"
        echo -e "  ${CYAN}all${NC}            - All components including database (default)"
        echo -e "  ${CYAN}db${NC}             - PostgreSQL database"
        echo -e "  ${CYAN}backend${NC}        - Backend API server"
        echo -e "  ${CYAN}frontend${NC}       - Frontend UI server"
        echo -e "  ${CYAN}prisma-studio${NC}  - Prisma Studio (database GUI)"
        echo ""
        echo -e "${YELLOW}Start/Stop Behavior:${NC}"
        echo -e "  ${GREEN}start all${NC}   → Database + Backend + Frontend"
        echo -e "  ${GREEN}stop all${NC}    → Database + Backend + Frontend"
        echo -e "  ${GREEN}restart all${NC} → Stop all → Wait 2s → Start all"
        echo -e "  ${YELLOW}Note:${NC} Prisma Studio is excluded from 'all' (manual start required)"
        echo ""
        echo -e "${YELLOW}Examples:${NC}"
        echo -e "  ${GREEN}Complete Control:${NC}"
        echo -e "    $0 start              # Start all (db + backend + frontend)"
        echo -e "    $0 stop               # Stop all (db + backend + frontend)"
        echo -e "    $0 restart            # Restart all components"
        echo -e "    $0 start prisma-studio # Start Prisma Studio (manual, not in 'all')"
        echo ""
        echo -e "  ${GREEN}Individual Components:${NC}"
        echo -e "    $0 start db           # Start database only"
        echo -e "    $0 restart backend    # Restart backend only (db stays running)"
        echo -e "    $0 stop frontend      # Stop frontend only (db + backend keep running)"
        echo ""
        echo -e "  ${GREEN}Status & Logs:${NC}"
        echo -e "    $0 status             # Show all components status"
        echo -e "    $0 status backend     # Show backend status only"
        echo -e "    $0 logs backend       # View backend logs (Ctrl+C to exit)"
        echo ""
        echo -e "  ${GREEN}Development Workflow:${NC}"
        echo -e "    $0 start              # Morning: start development"
        echo -e "    $0 restart backend    # After code change"
        echo -e "    $0 stop               # Evening: complete shutdown"
        echo ""
        echo -e "${YELLOW}Quick Start:${NC}"
        IP=$(hostname -I | awk '{print $1}')
        echo -e "  ${CYAN}1.${NC} $0 start              # Start the system"
        echo -e "  ${CYAN}2.${NC} Open http://${IP}:3000"
        echo -e "  ${CYAN}3.${NC} Login: admin / proadmin"
        echo ""
        echo -e "${YELLOW}💡 Tips:${NC}"
        echo -e "  • ${GREEN}Prisma Studio${NC} is excluded from 'all' for security"
        echo -e "  • ${GREEN}stop all${NC} stops database too (v2.0 change)"
        echo -e "  • Use individual commands to keep db running"
        echo -e "  • Check status anytime with: $0 status"
        echo ""
        exit 1
        ;;
esac

exit 0
