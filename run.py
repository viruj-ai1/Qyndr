import os
import sys
import time
import subprocess

def free_port(port):
    try:
        if os.name == 'nt':
            cmd = f'powershell -Command "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"'
            subprocess.run(cmd, shell=True, capture_output=True)
        else:
            cmd = f'lsof -ti:{port} | xargs kill -9'
            subprocess.run(cmd, shell=True, capture_output=True)
    except Exception:
        pass

def run():
    print("========================================")
    print("Starting DOE Workflow Studio...")
    print("========================================")

    # Ensure port 8000 is clean before starting
    free_port(8000)

    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Start Backend (FastAPI)
    backend_dir = os.path.join(base_dir, "backend")
    print("--> Starting Backend (FastAPI on http://127.0.0.1:8000)...")
    backend_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
        cwd=backend_dir,
        shell=False
    )

    # Start Frontend (Vite)
    frontend_dir = os.path.join(base_dir, "frontend")
    print("--> Starting Frontend (Vite)...")
    frontend_process = subprocess.Popen(
        "npm run dev",
        cwd=frontend_dir,
        shell=True
    )

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[!] Ctrl+C detected. Shutting down servers...")
        backend_process.terminate()
        frontend_process.terminate()
        backend_process.wait()
        frontend_process.wait()
        print("Servers stopped successfully. Goodbye!")

if __name__ == "__main__":
    run()
