import os
import sys
import time
import subprocess
import webbrowser

def free_port(port):
    try:
        if os.name == 'nt':
            cmd = f'powershell -Command "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object {{ Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }}"'
            subprocess.run(cmd, shell=True, capture_output=True)
        else:
            res = subprocess.run(f"lsof -ti:{port}", shell=True, capture_output=True, text=True)
            pids = res.stdout.strip().split()
            for pid in pids:
                if pid:
                    subprocess.run(f"kill -9 {pid}", shell=True, capture_output=True)
    except Exception:
        pass

def run():
    print("========================================")
    print("🚀 Starting DOE Workflow Studio...")
    print("========================================")

    # Ensure ports 8000 and 5173 are clean before starting
    free_port(8000)
    free_port(5173)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(base_dir, "frontend")
    backend_dir = os.path.join(base_dir, "backend")

    # Ensure frontend dependencies are installed
    node_modules_dir = os.path.join(frontend_dir, "node_modules")
    if not os.path.exists(node_modules_dir):
        print("--> Installing frontend dependencies (npm install)...")
        subprocess.run("npm install", cwd=frontend_dir, shell=True, check=True)

    # Build frontend if dist doesn't exist so FastAPI can also serve it directly
    dist_index = os.path.join(frontend_dir, "dist", "index.html")
    if not os.path.exists(dist_index):
        print("--> Building frontend static bundle (npm run build)...")
        subprocess.run("npm run build", cwd=frontend_dir, shell=True)

    # Start Backend (FastAPI)
    print("--> Starting Backend (FastAPI on http://127.0.0.1:8000)...")
    backend_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
        cwd=backend_dir,
        shell=False
    )

    # Start Frontend (Vite)
    print("--> Starting Frontend (Vite on http://127.0.0.1:5173)...")
    frontend_process = subprocess.Popen(
        "npm run dev",
        cwd=frontend_dir,
        shell=True
    )

    print("\n========================================================")
    print("✨ DOE Workflow Studio is running!")
    print("========================================================")
    print("  🌐 Frontend Web UI:      http://localhost:5173")
    print("  🌐 Direct FastAPI Web UI: http://localhost:8000")
    print("  ⚙️  API Documentation:    http://127.0.0.1:8000/docs")
    print("--------------------------------------------------------")
    print("  Default Admin Credentials:")
    print("    Username: r&d_lab_head")
    print("    Password: R&D_Lab_Head@VG.in")
    print("========================================================\n")

    # Try to open the frontend in the default browser after 2 seconds
    time.sleep(2)
    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

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
