# backend flask
import os
import time
import uuid
import base64
import random
import decimal
import threading
import numpy as np
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from threading import Lock
from functools import wraps

# computer vision yolo
import cv2
from ultralytics import YOLO

# db & sys
import psycopg2
import psycopg2.extras
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

# web
from flask import Flask, render_template, Response, jsonify, request, send_from_directory
from flask_cors import CORS

# jwt
import jwt

# -----------------------------
# CONFIG
# -----------------------------
# Put sensitive values into environment variables in production
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", 5432)),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASS", "gajahbengkak"),
    "dbname": os.environ.get("DB_NAME", "timbangandigitalai")
}

SECRET_KEY = os.environ.get("SECRET_KEY", "super-secret-dev-key")  # change in production
JWT_ALGO = "HS256"
JWT_EXP_HOURS = int(os.environ.get("JWT_EXP_HOURS", 4))

SIMULATE_SCALE = os.environ.get("SIMULATE_SCALE", "1") == "1"
SERIAL_PORT = os.environ.get("SERIAL_PORT", "COM3")
BAUD_RATE = int(os.environ.get("BAUD_RATE", 9600))

UPLOAD_FOLDER = os.path.join(os.getcwd(), "static", "assets", "img")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}

# app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# -----------------------------
# UTIL
# -----------------------------
def get_db():
    return psycopg2.connect(**DB_CONFIG)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def as_number(x):
    try:
        return float(x.cpu().numpy())
    except Exception:
        try:
            return float(x)
        except Exception:
            return 0.0

# -----------------------------
# YOLO dataset (model yolo)
# -----------------------------
try:
    model = YOLO("models/best.pt")
except Exception as e:
    print("⚠️ Peringatan: gagal load model YOLO:", e)
    model = None

cap = cv2.VideoCapture(0)

# global vars
latest_weight = 0.0
# changed: latest_detection is now a dict storing status per client_id
# structure: latest_detection[client_id] = {"detection": str, "weight": float, "ts": timestamp_iso}
latest_detection = {}
scale_connection = None

# worker pool for frames
WORKER_POOL = ThreadPoolExecutor(max_workers=4)
client_last_ts = {}
client_lock = Lock()
MIN_INTERVAL_S = 0.06

# -----------------------------
# AUTH helpers (JWT)
# -----------------------------
def create_token(email: str):
    payload = {
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXP_HOURS),
        "iat": datetime.utcnow()
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGO)
    # pyjwt returns str in v2+, bytes in older; ensure string
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGO])
        return payload
    except jwt.ExpiredSignatureError:
        raise
    except Exception as e:
        raise

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # 1. Ambil dari header
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]

        # 2. Ambil dari querystring
        if not token:
            token = request.args.get("token")

        if not token:
            return jsonify({'message': 'Token missing!'}), 401

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_email = data['email']
        except:
            return jsonify({'message': 'Token invalid!'}), 401

        return f(current_email, *args, **kwargs)
    return decorated


# -----------------------------
# Timbangan (simulasi/dummy)
# -----------------------------
def read_scale_data():
    global latest_weight, scale_connection
    if SIMULATE_SCALE:
        while True:
            latest_weight = round(random.uniform(0.1, 2.5), 3)
            time.sleep(1)
    else:
        try:
            import serial
            scale_connection = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
            print(f"✅ Berhasil terhubung ke timbangan di port {SERIAL_PORT}")
            while True:
                line = scale_connection.readline().decode('utf-8').strip()
                if line:
                    try:
                        latest_weight = float(line.split()[0])
                    except Exception:
                        print("⚠️ Format data dari timbangan tidak valid:", line)
                time.sleep(0.5)
        except Exception as e:
            print("❌ Gagal terhubung ke timbangan:", e)
            latest_weight = -1.0

# -----------------------------
# AUTH routes: signup / login / me
# -----------------------------
@app.route("/auth/signup", methods=["POST"])
def auth_signup():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "invalid_json"}), 400

    first = data.get("first_name") or data.get("first") or ""
    last = data.get("last_name") or data.get("last") or ""
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Silahkan masukkan email dan kata sandi Anda"}), 400

    db = get_db()
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cur.fetchone():
        cur.close(); db.close()
        return jsonify({"error": "Email sudah terdaftar, silahkan gunakan akun lain atau login dengan akun yang sudah ada"}), 400

    pw_hash = generate_password_hash(password)
    cur.execute(
        "INSERT INTO users (first_name, last_name, email, password_hash) VALUES (%s, %s, %s, %s) RETURNING id;",
        (first, last, email, pw_hash)
    )
    user = cur.fetchone()
    db.commit()
    cur.close(); db.close()
    return jsonify({"message": "registered", "id": user["id"]}), 201

@app.route("/auth/login", methods=["POST"])
def auth_login():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "invalid_json"}), 400

    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "Silahkan masukkan email dan kata sandi Anda"}), 400

    db = get_db()
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, email, password_hash FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    cur.close(); db.close()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "user atau password salah"}), 401

    token = create_token(user["email"])
    return jsonify({"token": token, "email": user["email"]})

@app.route("/auth/me", methods=["GET"])
@token_required
def auth_me(current_email):
    db = get_db()
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, first_name, last_name, email, role, created_at FROM users WHERE email = %s", (current_email,))
    u = cur.fetchone()
    cur.close(); db.close()
    if not u:
        return jsonify({"error": "not_found"}), 404
    # convert decimals/datetimes if present
    return jsonify(u)

# -----------------------------
# Existing public endpoints (kept)
# -----------------------------
# @app.route("/")
# def index():
    # try:
        # return render_template("index.html")
    # except Exception:
        # return "<h3>API Server running. No index.html found.</h3>"
@app.route("/")
def index():
    return jsonify({"status": "API running"})

@app.route("/api/status", methods=["POST"])
def api_status():
    """
    Expecting JSON: { "client_id": "<uuid>" }
    Returns: {"detection": "...", "weight": 0.123, "ts": "..."}
    If client_id missing, fallback to "server" latest (eg. video feed) or return default.
    """
    global latest_detection, latest_weight
    data = request.get_json(silent=True) or {}
    client_id = data.get("client_id")

    if client_id:
        status = latest_detection.get(client_id, {
            "detection": "-",
            "weight": latest_weight,
            "ts": datetime.now(tz=ZoneInfo("Asia/Jakarta")).isoformat()
        })
    else:
        # fallback: try server-side video feed key
        status = latest_detection.get("server", {
            "detection": "-",
            "weight": latest_weight,
            "ts": datetime.now(tz=ZoneInfo("Asia/Jakarta")).isoformat()
        })

    return jsonify(status)


# -----------------------------
# Video feed (DISABLED)
# Alasan:
# - Streaming MJPEG menjalankan YOLO terus-menerus
# - Terlalu berat untuk Raspberry Pi
# - Digantikan oleh endpoint /api/detect_frame (request-based)
# -----------------------------

# def generate_frames():
#     global latest_detection
#     if model is None:
#         while True:
#             blank = (255 * np.ones((480, 640, 3), dtype="uint8"))
#             ret, buffer = cv2.imencode('.jpg', blank)
#             frame_bytes = buffer.tobytes()
#             yield (b'--frame\r\n'
#                    b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
#     else:
#         while True:
#             success, frame = cap.read()
#             if not success:
#                 break
#             results = model(frame, conf=0.6, verbose=False)
#             annotated_frame = results[0].plot() if len(results) > 0 else frame
#             try:
#                 if len(results[0].boxes) > 0:
#                     top_detection = results[0].boxes[0]
#                     cls_idx = int(as_number(top_detection.cls)) if hasattr(top_detection, "cls") else 0
#                     label = model.names[cls_idx] if hasattr(model, "names") else str(cls_idx)
#                     # store server-side detection under a special key
#                     latest_detection["server"] = {
#                         "detection": label,
#                         "weight": latest_weight,
#                         "ts": datetime.now(tz=ZoneInfo("Asia/Jakarta")).isoformat()
#                     }
#                 else:
#                     latest_detection["server"] = {
#                         "detection": "Tidak ada",
#                         "weight": latest_weight,
#                         "ts": datetime.now(tz=ZoneInfo("Asia/Jakarta")).isoformat()
#                     }
#             except Exception:
#                 latest_detection["server"] = {
#                     "detection": "Tidak ada",
#                     "weight": latest_weight,
#                     "ts": datetime.now(tz=ZoneInfo("Asia/Jakarta")).isoformat()
#                 }
#
#             ret, buffer = cv2.imencode('.jpg', annotated_frame)
#             frame_bytes = buffer.tobytes()
#             yield (b'--frame\r\n'
#                    b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')


# Protected video feed endpoint
# @app.route("/video_feed")
# @token_required
# def video_feed(current_email):
#    return jsonify({
#        "error": "video_feed_disabled",
#        "message": "Video streaming dinonaktifkan. Gunakan endpoint /api/detect_frame untuk inferensi YOLO."
#    }), 410

# -----------------------------
# CRUD Produk (kept), protect mutations
# -----------------------------
@app.route("/api/produk", methods=["GET"])
def api_get_produk():
    try:
        db = get_db()
        cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("SELECT kode_produk, nama_produk, harga_per_kg, path_gambar FROM produk ORDER BY kode_produk ASC;")
        produk = cursor.fetchall()
        cursor.close(); db.close()
        for p in produk:
            if "harga_per_kg" in p and isinstance(p["harga_per_kg"], decimal.Decimal):
                p["harga_per_kg"] = float(p["harga_per_kg"])
        return jsonify(produk)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/produk/<int:kode_produk>", methods=["GET"])
def api_get_produk_single(kode_produk):
    try:
        db = get_db()
        cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("SELECT kode_produk, nama_produk, harga_per_kg, path_gambar FROM produk WHERE kode_produk = %s;", (kode_produk,))
        produk = cursor.fetchone()
        cursor.close(); db.close()
        if not produk:
            return jsonify({"error": "Produk tidak ditemukan"}), 404
        if "harga_per_kg" in produk and isinstance(produk["harga_per_kg"], decimal.Decimal):
            produk["harga_per_kg"] = float(produk["harga_per_kg"])
        return jsonify(produk)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/produk", methods=["POST"])
@token_required
def api_create_produk(current_email):
    try:
        # --- AMBIL DATA ---
        if request.content_type and "multipart/form-data" in request.content_type:
            nama = request.form.get("nama_produk")
            harga = request.form.get("harga_per_kg")
            file = request.files.get("gambar")
        else:
            body = request.get_json(force=True)
            nama = body.get("nama_produk")
            harga = body.get("harga_per_kg")
            file = None

        # --- VALIDASI WAJIB ---
        if not nama or harga is None:
            return jsonify({"error": "nama_produk dan harga_per_kg wajib diisi"}), 400

        # --- VALIDASI ANGKA & MINUS ---
        try:
            harga_value = float(harga)
            if harga_value < 0:
                return jsonify({"error": "harga_per_kg tidak boleh minus"}), 400
        except:
            return jsonify({"error": "harga_per_kg harus berupa angka"}), 400

        # --- PROSES GAMBAR ---
        path_gambar = None
        if file and file.filename != "":
            if allowed_file(file.filename):
                filename = secure_filename(file.filename)
                name, ext = os.path.splitext(filename)
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
                filename = f"{name}_{timestamp}{ext}"
                save_path = os.path.join(UPLOAD_FOLDER, filename)
                file.save(save_path)
                path_gambar = f"/static/assets/img/{filename}"
            else:
                return jsonify({"error": "Format file tidak diizinkan"}), 400

        # --- INSERT DB (harga_value) ---
        db = get_db()
        cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            "INSERT INTO produk (nama_produk, harga_per_kg, path_gambar) VALUES (%s, %s, %s) RETURNING kode_produk, nama_produk, harga_per_kg, path_gambar;",
            (nama, harga_value, path_gambar)
        )
        new_prod = cursor.fetchone()
        db.commit()
        cursor.close(); db.close()

        if new_prod and "harga_per_kg" in new_prod and isinstance(new_prod["harga_per_kg"], decimal.Decimal):
            new_prod["harga_per_kg"] = float(new_prod["harga_per_kg"])

        return jsonify(new_prod), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/produk/<int:kode_produk>", methods=["PUT"])
@token_required
def api_update_produk(current_email, kode_produk):
    try:
        if request.content_type and "multipart/form-data" in request.content_type:
            nama = request.form.get("nama_produk")
            harga = request.form.get("harga_per_kg")
            file = request.files.get("gambar")
        else:
            body = request.get_json(force=True)
            nama = body.get("nama_produk")
            harga = body.get("harga_per_kg")
            file = None

        if nama is None and harga is None and file is None:
            return jsonify({"error": "Tidak ada data untuk diperbarui"}), 400

        updates = []
        values = []
        if nama is not None:
            updates.append("nama_produk = %s"); values.append(nama)
        if harga is not None:
            updates.append("harga_per_kg = %s"); values.append(harga)
        if file and file.filename != "":
            if allowed_file(file.filename):
                filename = secure_filename(file.filename)
                name, ext = os.path.splitext(filename)
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
                filename = f"{name}_{timestamp}{ext}"
                save_path = os.path.join(UPLOAD_FOLDER, filename)
                file.save(save_path)
                relative = f"/static/assets/img/{filename}"
                updates.append("path_gambar = %s")
                values.append(relative)
            else:
                return jsonify({"error": "Format file tidak diizinkan"}), 400

        values.append(kode_produk)
        sql = f"UPDATE produk SET {', '.join(updates)} WHERE kode_produk = %s RETURNING kode_produk, nama_produk, harga_per_kg, path_gambar;"
        db = get_db()
        cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(sql, tuple(values))
        updated = cursor.fetchone()
        db.commit()
        cursor.close(); db.close()
        if not updated:
            return jsonify({"error": "Produk tidak ditemukan"}), 404
        if "harga_per_kg" in updated and isinstance(updated["harga_per_kg"], decimal.Decimal):
            updated["harga_per_kg"] = float(updated["harga_per_kg"])
        return jsonify(updated)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/produk/<int:kode_produk>", methods=["DELETE"])
@token_required
def api_delete_produk(current_email, kode_produk):
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("DELETE FROM produk WHERE kode_produk = %s RETURNING kode_produk;", (kode_produk,))
        deleted = cursor.fetchone()
        db.commit()
        cursor.close(); db.close()
        if not deleted:
            return jsonify({"error": "Produk tidak ditemukan"}), 404
        return jsonify({"message": f"Produk {kode_produk} berhasil dihapus"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/static/assets/img/<path:filename>")
def serve_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# -----------------------------
# transaksi / cetak (protected)
# -----------------------------
@app.route("/cetak", methods=["POST"])
@token_required
def cetak(current_email):
    data = request.get_json()
    try:
        db = get_db()
        cursor = db.cursor()
        sql = """
            INSERT INTO transaksi (nama_produk, berat_kg, harga_per_kg, total_harga, timestamp) 
            VALUES (%s, %s, %s, %s, %s)
        """
        val = (
            data['nama_produk'],
            data['berat_kg'],
            data['harga_per_kg'],
            data['total_harga'],
            datetime.now()
        )
        cursor.execute(sql, val)
        db.commit()
        cursor.close(); db.close()
        return jsonify({"status": f"✅ Transaksi {data['nama_produk']} berhasil disimpan!"})
    except Exception as e:
        return jsonify({"status": f"❌ Gagal menyimpan: {e}"}), 500

@app.route("/api/riwayat", methods=["GET"])
@token_required
def get_riwayat(current_user):
    tanggal = request.args.get("tanggal", "")
    sort = request.args.get("sort", "desc")
    try:
        db = get_db()
        cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        query = """
            SELECT id,
                   nama_produk,
                   berat_kg AS berat,
                   harga_per_kg,
                   total_harga,
                   timestamp AS waktu
            FROM transaksi
        """
        params = []

        if tanggal:
            if ":" in tanggal:
                start_date, end_date = tanggal.split(":")
                query += " WHERE DATE(timestamp) BETWEEN %s AND %s"
                params.extend([start_date, end_date])
            else:
                query += " WHERE DATE(timestamp) = %s"
                params.append(tanggal)

        # default sort by time only
        query += f" ORDER BY timestamp {'ASC' if sort == 'asc' else 'DESC'}"

        cur.execute(query, tuple(params))
        rows = cur.fetchall()

        for r in rows:
            for k, v in r.items():
                if isinstance(v, decimal.Decimal):
                    r[k] = float(v)

        cur.close(); db.close()
        return jsonify(rows)
    except Exception as e:
        print("❌ Error saat ambil riwayat:", e)
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Multi-client detect_frame (protected)
# -----------------------------
def process_frame_yolo(frame):
    global model
    if model is None:
        ret, buf = cv2.imencode('.jpg', frame)
        return "Model not loaded", [], buf.tobytes()
    results = model(frame, conf=0.6, verbose=False)
    detections = []
    top_label = "Tidak ada"
    try:
        boxes = results[0].boxes
    except Exception:
        boxes = []
    if len(boxes) > 0:
        for box in boxes:
            try:
                cls_idx = int(as_number(box.cls))
            except Exception:
                cls_idx = int(box.cls) if hasattr(box, "cls") else 0
            try:
                conf = float(as_number(box.conf))
            except Exception:
                conf = float(box.conf) if hasattr(box, "conf") else 0.0
            try:
                xyxy = box.xyxy[0]
                x1 = float(as_number(xyxy[0])); y1 = float(as_number(xyxy[1]))
                x2 = float(as_number(xyxy[2])); y2 = float(as_number(xyxy[3]))
            except Exception:
                x1 = y1 = x2 = y2 = 0.0
            label = model.names[cls_idx] if hasattr(model, "names") else str(cls_idx)
            detections.append({
                "cls": cls_idx, "label": label, "conf": round(conf, 4),
                "x1": round(x1,1), "y1": round(y1,1), "x2": round(x2,1), "y2": round(y2,1)
            })
        top_label = detections[0]["label"]
    try:
        annotated = results[0].plot()
    except Exception:
        annotated = frame
    ret, buf = cv2.imencode('.jpg', annotated)
    jpeg_bytes = buf.tobytes()
    return top_label, detections, jpeg_bytes

@app.route("/api/detect_frame", methods=["POST"])
@token_required
def api_detect_frame(current_email):
    """
    Expects JSON: { frame: dataURL, client_id: "<uuid>" }
    Stores latest_detection[client_id] = {"detection": label, "weight": latest_weight, "ts": ...}
    Returns detection, boxes, annotated_frame
    """
    global latest_detection, latest_weight
    try:
        data = request.get_json(force=True)
    except Exception as e:
        return jsonify({"error": "invalid_json", "detail": str(e)}), 400

    frame_b64 = data.get("frame")
    client_id = data.get("client_id") or str(uuid.uuid4())
    if not frame_b64:
        return jsonify({"error": "no_frame_provided"}), 400

    now = time.time()
    with client_lock:
        last = client_last_ts.get(client_id, 0)
        if now - last < MIN_INTERVAL_S:
            return jsonify({"error": "too_many_requests", "min_interval_s": MIN_INTERVAL_S}), 429
        client_last_ts[client_id] = now

    try:
        if "," in frame_b64:
            _, b64 = frame_b64.split(",", 1)
        else:
            b64 = frame_b64
        img_bytes = base64.b64decode(b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("cannot_decode_frame")
    except Exception as e:
        return jsonify({"error": "failed_decode_frame", "detail": str(e)}), 400

    fut = WORKER_POOL.submit(process_frame_yolo, frame)
    try:
        label, boxes, annotated_bytes = fut.result(timeout=12)
    except TimeoutError:
        return jsonify({"error": "processing_timeout"}), 504
    except Exception as e:
        return jsonify({"error": "processing_error", "detail": str(e)}), 500

    # store per-client detection (include weight and timestamp)
    latest_detection[client_id] = {
        "detection": label,
        "weight": latest_weight,
        "ts": datetime.now(tz=ZoneInfo("Asia/Jakarta")).isoformat()
    }

    try:
        encoded = base64.b64encode(annotated_bytes).decode('utf-8')
        annotated_b64 = f"data:image/jpeg;base64,{encoded}"
    except Exception:
        annotated_b64 = None

    resp = {
        "detection": label,
        "boxes": boxes,
        "annotated_frame": annotated_b64,
        "server_time": datetime.now(tz=ZoneInfo("Asia/Jakarta")).isoformat()
    }
    return jsonify(resp)

# -----------------------------
# Run app
# -----------------------------
if __name__ == "__main__":
    t = threading.Thread(target=read_scale_data, daemon=True)
    t.start()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True, use_reloader=False)
